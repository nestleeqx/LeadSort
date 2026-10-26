from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.deps import IpDep, QueueDep, RedisDep, SessionDep, VisitorDep
from app.models import CrmRequest, Lead
from app.schemas import (
    BoardOut,
    CrmSend,
    FormSubmit,
    LeadCreate,
    LeadDetail,
    LeadMove,
    LeadOut,
    StatsOut,
    TriageEdit,
)
from app.services.crm import CRM_NAMES, build_request, demo_response
from app.services.demo import ensure_visitor, reset_demo
from app.services.export import leads_csv
from app.services.leads import add_event, create_lead, edit_triage, form_text, move_lead
from app.services.redis_store import hit_limit
from app.services.stats import board_stats

router = APIRouter(prefix="/api", tags=["leads"])


async def _board(session: AsyncSession, visitor: str) -> BoardOut:
    leads = await session.scalars(
        select(Lead).where(Lead.visitor_id == visitor).order_by(Lead.status, Lead.position)
    )
    return BoardOut(leads=[LeadOut.model_validate(lead) for lead in leads])


async def _lead(session: AsyncSession, visitor: str, lead_id: str, events: bool = False) -> Lead:
    query = select(Lead).where(Lead.id == lead_id, Lead.visitor_id == visitor)
    if events:
        query = query.options(selectinload(Lead.events), selectinload(Lead.crm_requests))
    lead = await session.scalar(query)
    if lead is None:
        raise HTTPException(404, "Заявка не найдена — возможно, демо сбросили. Обновите страницу.")
    return lead


async def _detail(session: AsyncSession, visitor: str, lead_id: str) -> LeadDetail:
    # Свежая загрузка: история могла пополниться в этом же запросе
    session.expunge_all()
    return LeadDetail.model_validate(await _lead(session, visitor, lead_id, events=True))


def _check_text(text: str) -> str:
    text = text.strip()
    limit = get_settings().max_lead_chars
    if not text:
        raise HTTPException(422, "Вставьте текст заявки.")
    if len(text) > limit:
        raise HTTPException(422, f"Текст заявки длиннее {limit} символов — сократите его.")
    return text


@router.get("/leads", response_model=BoardOut)
async def board(session: SessionDep, visitor: VisitorDep, queue: QueueDep):
    await ensure_visitor(session, visitor)
    # Без фоновых процессов (Vercel) каждый опрос доски разбирает следующие заявки
    await queue.kick(visitor)
    return await _board(session, visitor)


@router.post("/leads", response_model=LeadOut, status_code=201)
async def add_lead(
    body: LeadCreate,
    session: SessionDep,
    visitor: VisitorDep,
    redis: RedisDep,
    ip: IpDep,
    queue: QueueDep,
):
    """Заявка, вставленная вручную: текст письма или сообщения."""
    text = _check_text(body.text)
    await ensure_visitor(session, visitor)
    await hit_limit(redis, "triage", ip, get_settings().triages_per_hour)
    lead = await create_lead(session, visitor, "manual", text)
    await session.commit()
    if not queue.polling:
        await queue.kick(visitor)
    return LeadOut.model_validate(lead)


@router.post("/form", response_model=LeadOut, status_code=201)
async def submit_form(
    body: FormSubmit,
    session: SessionDep,
    visitor: VisitorDep,
    redis: RedisDep,
    ip: IpDep,
    queue: QueueDep,
):
    """Заявка с формы на сайте студии «Пиксель». Ответ — сразу, разбор идёт в фоне."""
    name, contact, message = body.name.strip(), body.contact.strip(), body.message.strip()
    if not message and not contact:
        raise HTTPException(422, "Напишите, что нужно сделать, или оставьте контакт для связи.")
    await ensure_visitor(session, visitor)
    await hit_limit(redis, "triage", ip, get_settings().triages_per_hour)
    lead = await create_lead(session, visitor, "form", form_text(name, contact, message))
    await session.commit()
    if not queue.polling:
        await queue.kick(visitor)
    return LeadOut.model_validate(lead)


@router.get("/leads/{lead_id}", response_model=LeadDetail)
async def lead_detail(lead_id: str, session: SessionDep, visitor: VisitorDep, queue: QueueDep):
    lead = await _lead(session, visitor, lead_id, events=True)
    if queue.polling and lead.state in {"queued", "running"}:
        # Без фоновых процессов заявку разбирает опрос — со страницы формы или с доски
        await queue.kick(visitor)
        return await _detail(session, visitor, lead_id)
    return LeadDetail.model_validate(lead)


@router.patch("/leads/{lead_id}", response_model=LeadOut)
async def move(lead_id: str, body: LeadMove, session: SessionDep, visitor: VisitorDep):
    """Перенос карточки между колонками или внутри колонки."""
    lead = await _lead(session, visitor, lead_id)
    await move_lead(session, lead, body.status, body.position)
    await session.commit()
    return LeadOut.model_validate(lead)


@router.patch("/leads/{lead_id}/triage", response_model=LeadDetail)
async def edit(lead_id: str, body: TriageEdit, session: SessionDep, visitor: VisitorDep):
    """Ручная правка полей разбора."""
    lead = await _lead(session, visitor, lead_id)
    if lead.triage is None:
        raise HTTPException(409, "Заявка ещё разбирается — подождите несколько секунд.")
    await edit_triage(session, lead, body)
    await session.commit()
    return await _detail(session, visitor, lead_id)


@router.post("/leads/{lead_id}/retriage", response_model=LeadDetail)
async def retriage(
    lead_id: str,
    session: SessionDep,
    visitor: VisitorDep,
    redis: RedisDep,
    ip: IpDep,
    queue: QueueDep,
):
    """Разобрать заново: ручные правки заменяются свежим разбором нейросети."""
    lead = await _lead(session, visitor, lead_id)
    if lead.state in {"queued", "running"}:
        raise HTTPException(409, "Заявка уже разбирается.")
    await hit_limit(redis, "triage", ip, get_settings().triages_per_hour)
    lead.state = "queued"
    lead.error = None
    add_event(session, lead.id, "Отправлена на повторный разбор")
    await session.commit()
    if not queue.polling:
        await queue.kick(visitor)
    return await _detail(session, visitor, lead_id)


@router.post("/demo/reset", response_model=BoardOut)
async def reset(session: SessionDep, visitor: VisitorDep, redis: RedisDep, ip: IpDep):
    """Вернуть доску к исходным 25 заявкам «Пикселя»."""
    await hit_limit(redis, "reset", ip, get_settings().demo_resets_per_hour)
    await ensure_visitor(session, visitor)
    await reset_demo(session, visitor)
    return await _board(session, visitor)


@router.post("/leads/{lead_id}/crm", response_model=LeadDetail)
async def send_to_crm(lead_id: str, body: CrmSend, session: SessionDep, visitor: VisitorDep):
    """Передать заявку в amoCRM или Битрикс24. В демо — запрос собирается, но не отправляется."""
    lead = await _lead(session, visitor, lead_id)
    if lead.triage is None:
        raise HTTPException(409, "Заявка ещё разбирается — подождите несколько секунд.")
    session.add(
        CrmRequest(
            lead_id=lead.id,
            crm=body.crm,
            request=build_request(body.crm, lead),
            response=demo_response(body.crm),
        )
    )
    add_event(
        session, lead.id, f"Передана в {CRM_NAMES[body.crm]} (демо: запрос сохранён, не отправлен)"
    )
    await session.commit()
    return await _detail(session, visitor, lead_id)


async def _all_leads(session: AsyncSession, visitor: str) -> list[Lead]:
    await ensure_visitor(session, visitor)
    return list(await session.scalars(select(Lead).where(Lead.visitor_id == visitor)))


@router.get("/stats", response_model=StatsOut)
async def stats(session: SessionDep, visitor: VisitorDep):
    return board_stats(await _all_leads(session, visitor))


@router.get("/export/leads.csv")
async def export_csv(session: SessionDep, visitor: VisitorDep):
    """Все заявки доски в CSV для Excel и Google Таблиц."""
    name = f"leadsort-{datetime.now(UTC).date().isoformat()}.csv"
    return Response(
        leads_csv(await _all_leads(session, visitor)),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
