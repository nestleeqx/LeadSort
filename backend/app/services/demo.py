"""Демо-доска студии «Пиксель» и очистка старых досок.

Заявки и их разборы лежат в app/seed уже готовыми (scripts/evaluate_demo.py),
поэтому первый визит не тратит токены.
"""

import json
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lead, LeadEvent, Visitor
from app.services.leads import CHANNELS, add_event, triaged_text

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
# Отметку «был на сайте» обновляем не чаще, чем раз в несколько минут: доска опрашивается часто
SEEN_EVERY = timedelta(minutes=5)


@lru_cache
def demo_leads() -> list[dict]:
    return json.loads((SEED_DIR / "pixel-leads.json").read_text(encoding="utf-8"))


@lru_cache
def demo_results() -> dict[str, dict]:
    data = json.loads((SEED_DIR / "pixel-leads.results.json").read_text(encoding="utf-8"))
    return data["results"]


async def seed_demo(session: AsyncSession, visitor_id: str) -> None:
    now = datetime.now(UTC)
    leads = demo_leads()
    results = demo_results()
    # Внутри колонки свежие заявки выше
    order = {
        item["id"]: index
        for index, item in enumerate(sorted(leads, key=lambda item: item["hours_ago"]))
    }
    for item in leads:
        result = results[item["id"]]
        created = now - timedelta(hours=item["hours_ago"])
        lead = Lead(
            visitor_id=visitor_id,
            channel=item["channel"],
            status=item["status"],
            position=float(order[item["id"]]),
            text=item["text"],
            state="done",
            triage=result["triage"],
            highlights=result["highlights"],
            notes=result["notes"],
            method=result["method"],
            elapsed_ms=result["elapsed_ms"],
            edited=[],
            demo_id=item["id"],
            created_at=created,
        )
        session.add(lead)
        await session.flush()
        add_event(session, lead.id, f"Заявка получена: {CHANNELS[item['channel']]}", created)
        triaged_at = created + timedelta(milliseconds=result["elapsed_ms"] or 0)
        triaged = triaged_text(result["method"], result["elapsed_ms"])
        add_event(session, lead.id, triaged, triaged_at)
        if item["status"] == "spam":
            add_event(session, lead.id, "Отправлена в спам автоматически", triaged_at)


async def ensure_visitor(session: AsyncSession, visitor_id: str) -> None:
    """Первый визит — создаём посетителя и его копию демо-доски."""
    visitor = await session.get(Visitor, visitor_id)
    now = datetime.now(UTC)
    if visitor is None:
        try:
            session.add(Visitor(id=visitor_id, created_at=now, last_seen_at=now))
            await session.flush()
            await seed_demo(session, visitor_id)
            await session.commit()
        except IntegrityError:
            # Первые запросы пришли одновременно — демо уже создал соседний
            await session.rollback()
    elif _aware(visitor.last_seen_at) < now - SEEN_EVERY:
        visitor.last_seen_at = now
        await session.commit()


def _aware(value: datetime) -> datetime:
    # SQLite в тестах отдаёт время без часового пояса
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def _delete_boards(session: AsyncSession, visitor_ids: list[str]) -> None:
    # Удаляем явно, а не каскадом: в SQLite внешние ключи по умолчанию не проверяются
    lead_ids = select(Lead.id).where(Lead.visitor_id.in_(visitor_ids))
    await session.execute(delete(LeadEvent).where(LeadEvent.lead_id.in_(lead_ids)))
    await session.execute(delete(Lead).where(Lead.visitor_id.in_(visitor_ids)))


async def reset_demo(session: AsyncSession, visitor_id: str) -> None:
    await _delete_boards(session, [visitor_id])
    await seed_demo(session, visitor_id)
    await session.commit()


async def cleanup_old(session: AsyncSession, ttl_hours: int) -> int:
    cutoff = datetime.now(UTC) - timedelta(hours=ttl_hours)
    ids = list(await session.scalars(select(Visitor.id).where(Visitor.last_seen_at < cutoff)))
    if ids:
        await _delete_boards(session, ids)
        await session.execute(delete(Visitor).where(Visitor.id.in_(ids)))
        await session.commit()
    return len(ids)
