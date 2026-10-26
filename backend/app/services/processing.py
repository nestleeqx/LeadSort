"""Разбор заявок в фоне: задачей в процессе API или по опросу доски (serverless)."""

import asyncio
import logging
import time
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.llm import LLMError, LLMProvider
from app.models import Lead
from app.services.leads import add_event, apply_result
from app.services.triage import triage_lead

log = logging.getLogger(__name__)

# Заявка «в работе» дольше этого срока считается брошенной (упал процесс или функция)
STALE_AFTER = timedelta(minutes=2)
FAILED = "Нейросеть не ответила. Нажмите «Разобрать заново»."


async def claim(sessions: async_sessionmaker, visitor_id: str | None, limit: int) -> list[str]:
    """Забирает до limit заявок из очереди и переводит их в running."""
    async with sessions() as session:
        stale = update(Lead).where(
            Lead.state == "running", Lead.started_at < datetime.now(UTC) - STALE_AFTER
        )
        query = select(Lead.id).where(Lead.state == "queued")
        if visitor_id:
            stale = stale.where(Lead.visitor_id == visitor_id)
            query = query.where(Lead.visitor_id == visitor_id)
        await session.execute(stale.values(state="queued"))
        candidates = list(
            await session.scalars(
                query.order_by(Lead.created_at).limit(limit).with_for_update(skip_locked=True)
            )
        )
        claimed = []
        for lead_id in candidates:
            # Условие на state защищает от двойного разбора, если очередь опрашивают параллельно
            result = await session.execute(
                update(Lead)
                .where(Lead.id == lead_id, Lead.state == "queued")
                .values(state="running", started_at=datetime.now(UTC), error=None)
            )
            if result.rowcount:
                claimed.append(lead_id)
        await session.commit()
    return claimed


async def process_lead(
    sessions: async_sessionmaker, provider: LLMProvider, redis: Redis, lead_id: str
) -> None:
    """Разбирает заявку, которую уже забрали в running."""
    async with sessions() as session:
        lead = await session.get(Lead, lead_id)
        if lead is None or lead.state != "running":
            return
        text = lead.text

    started = time.perf_counter()
    result = error = None
    try:
        result = await triage_lead(provider, redis, text)
    except LLMError as e:
        # Пользователь видит только понятный текст, подробности — в логе
        log.warning("Заявка %s: %s", lead_id, e)
        error = FAILED
    except Exception:
        log.exception("Заявка %s: разбор упал", lead_id)
        error = FAILED
    elapsed = round((time.perf_counter() - started) * 1000)

    async with sessions() as session:
        lead = await session.get(Lead, lead_id)
        if lead is None or lead.state != "running":
            return
        if result is not None:
            apply_result(session, lead, result, elapsed)
        else:
            lead.state = "error"
            lead.error = error
            add_event(session, lead.id, "Не удалось разобрать")
        await session.commit()


class InlineQueue:
    """Разбор фоновой задачей в процессе API — Docker, VPS, тесты."""

    polling = False

    def __init__(self, sessions, provider, redis, concurrency: int = 5):
        self._args = (sessions, provider, redis)
        self.concurrency = concurrency
        self.tasks: set[asyncio.Task] = set()
        self._again = False

    async def kick(self, visitor_id: str | None = None) -> None:
        if any(not t.done() for t in self.tasks):
            # Уже идёт разбор — он сам заберёт новые заявки, когда освободится
            self._again = True
            return
        task = asyncio.create_task(self._drain())
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _drain(self) -> None:
        sessions = self._args[0]
        while True:
            self._again = False
            ids = await claim(sessions, None, self.concurrency)
            if ids:
                await asyncio.gather(*(process_lead(*self._args, i) for i in ids))
            elif not self._again:
                return

    async def drain(self) -> None:
        """Дождаться, пока очередь опустеет (для тестов)."""
        while self.tasks:
            await asyncio.gather(*list(self.tasks))


class PollQueue:
    """Очередь без фоновых процессов: заявки ждут в queued, пока доска опрашивает API,
    и каждый опрос разбирает следующую порцию прямо в запросе."""

    polling = True

    def __init__(self, sessions, provider, redis, concurrency: int = 5):
        self._args = (sessions, provider, redis)
        self.concurrency = concurrency

    async def kick(self, visitor_id: str | None = None) -> None:
        ids = await claim(self._args[0], visitor_id, self.concurrency)
        await asyncio.gather(*(process_lead(*self._args, i) for i in ids))

    async def drain(self) -> None:
        return None
