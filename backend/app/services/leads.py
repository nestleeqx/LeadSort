"""Операции с заявками на доске: создание, результат разбора, перенос, ручная правка.

История заявки пишется готовыми фразами — интерфейс показывает их как есть.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lead, LeadEvent
from app.schemas import Triage, TriageEdit
from app.services.triage import TriageResult

COLUMNS = {
    "new": "Новая",
    "in_progress": "В работе",
    "waiting": "Ждём клиента",
    "closed": "Закрыта",
    "spam": "Спам",
}
CHANNELS = {"form": "форма на сайте", "telegram": "Telegram", "manual": "добавлена вручную"}
FIELDS = {
    "type": "тип",
    "urgency": "срочность",
    "urgency_reason": "причина срочности",
    "contacts": "контакты",
    "budget": "бюджет",
    "deadline": "сроки",
    "summary": "резюме",
    "missing": "вопросы клиенту",
    "reply_draft": "черновик ответа",
}
# Быстрее этого нейросеть не отвечает — значит, разбор взят из кеша
CACHED_MS = 300
# Заявку вернули из спама, а тип у неё всё ещё «спам»: ставим нейтральный, менеджер уточнит
RESTORED_TYPE = "question"


def add_event(session: AsyncSession, lead_id: str, text: str, at: datetime | None = None) -> None:
    session.add(LeadEvent(lead_id=lead_id, text=text, at=at or datetime.now(UTC)))


def triaged_text(method: str | None, elapsed_ms: int | None) -> str:
    if method == "rules":
        return "Разобрана по правилам, без нейросети"
    if (elapsed_ms or 0) < CACHED_MS:
        return "Разобрана мгновенно: такой же текст уже разбирали"
    seconds = f"{(elapsed_ms or 0) / 1000:.1f}".replace(".", ",")
    # Неразрывный пробел: «с» не уезжает на отдельную строку в узкой истории
    return f"Разобрана нейросетью за {seconds} с"


async def top_position(session: AsyncSession, visitor_id: str, status: str) -> float:
    """Позиция над всеми карточками колонки — новые заявки встают наверх."""
    lowest = await session.scalar(
        select(func.min(Lead.position)).where(Lead.visitor_id == visitor_id, Lead.status == status)
    )
    return (lowest if lowest is not None else 1.0) - 1.0


def form_text(name: str, contact: str, message: str) -> str:
    """Текст заявки с формы — как его увидел бы менеджер в письме-уведомлении."""
    head = [f"Имя: {name}" if name else "", f"Контакт: {contact}" if contact else ""]
    head = [line for line in head if line]
    return "\n".join(head) + ("\n\n" if head and message else "") + message


async def create_lead(session: AsyncSession, visitor_id: str, channel: str, text: str) -> Lead:
    lead = Lead(
        visitor_id=visitor_id,
        channel=channel,
        text=text,
        status="new",
        position=await top_position(session, visitor_id, "new"),
        state="queued",
    )
    session.add(lead)
    await session.flush()
    add_event(session, lead.id, f"Заявка получена: {CHANNELS[channel]}")
    return lead


def apply_result(session: AsyncSession, lead: Lead, result: TriageResult, elapsed_ms: int) -> None:
    """Записывает разбор. Спам из колонки «Новая» уходит в «Спам» сам."""
    lead.state = "done"
    lead.error = None
    lead.triage = result.triage.model_dump()
    lead.highlights = [h.model_dump() for h in result.highlights]
    lead.notes = result.notes
    lead.method = result.method
    lead.elapsed_ms = elapsed_ms
    lead.edited = []
    add_event(session, lead.id, triaged_text(result.method, elapsed_ms))

    spam = result.triage.type == "spam"
    if spam and lead.status == "new":
        lead.status = "spam"
        add_event(session, lead.id, "Отправлена в спам автоматически")
    elif not spam and lead.status == "spam":
        # Разобрали заново, и это уже не спам — возвращаем на доску
        lead.status = "new"
        add_event(session, lead.id, "Вернулась из спама после повторного разбора")


def _set_type(lead: Lead, value: str) -> None:
    triage = Triage.model_validate(lead.triage)
    triage.type = value
    triage.notify = triage.urgency == "high" and value != "spam"
    lead.triage = triage.model_dump()
    if "type" not in lead.edited:
        lead.edited = [*lead.edited, "type"]


async def move_lead(session: AsyncSession, lead: Lead, status: str, position: float | None) -> None:
    """Перенос карточки. В колонку «Спам» и из неё — вместе со сменой типа."""
    if status == lead.status:
        if position is not None:
            lead.position = position
        return
    if position is None:
        position = await top_position(session, lead.visitor_id, status)
    lead.position = position
    was = lead.status
    lead.status = status
    if status == "spam":
        add_event(session, lead.id, "Отмечена как спам")
        if lead.triage and lead.triage["type"] != "spam":
            _set_type(lead, "spam")
    elif was == "spam":
        add_event(session, lead.id, f"Возвращена из спама в «{COLUMNS[status]}»")
        if lead.triage and lead.triage["type"] == "spam":
            _set_type(lead, RESTORED_TYPE)
    else:
        add_event(session, lead.id, f"Перенесена в «{COLUMNS[status]}»")


async def edit_triage(session: AsyncSession, lead: Lead, patch: TriageEdit) -> None:
    changes: dict[str, Any] = patch.model_dump(exclude_unset=True, exclude_none=True)
    current = Triage.model_validate(lead.triage)
    data = current.model_dump()
    changed = [key for key, value in changes.items() if data[key] != value]
    if not changed:
        return
    data.update({key: changes[key] for key in changed})
    if "missing" in changed:
        data["missing"] = [q.strip() for q in data["missing"] if q.strip()]
    data["notify"] = data["urgency"] == "high" and data["type"] != "spam"
    lead.triage = Triage.model_validate(data).model_dump()
    lead.edited = [*lead.edited, *(key for key in changed if key not in lead.edited)]
    add_event(session, lead.id, "Поправлено вручную: " + ", ".join(FIELDS[k] for k in changed))

    if "type" in changed:
        if data["type"] == "spam" and lead.status != "spam":
            lead.status = "spam"
            lead.position = await top_position(session, lead.visitor_id, "spam")
            add_event(session, lead.id, "Перенесена в «Спам»")
        elif data["type"] != "spam" and lead.status == "spam":
            lead.status = "new"
            lead.position = await top_position(session, lead.visitor_id, "new")
            add_event(session, lead.id, "Возвращена из спама в «Новая»")
