"""Статистика доски: заявки за неделю, распределения по типам, каналам и колонкам."""

from collections import Counter
from datetime import UTC, datetime, timedelta

from app.models import Lead
from app.schemas import Count, DayCount, StatsOut
from app.services.leads import CACHED_MS
from app.services.prompts import MOSCOW

DAYS = 7
TYPES = ["new_site", "improvement", "support", "question", "spam"]
CHANNELS = ["form", "telegram", "manual"]
COLUMNS = ["new", "in_progress", "waiting", "closed", "spam"]


def _local_day(value: datetime) -> str:
    # SQLite в тестах отдаёт время без часового пояса
    aware = value if value.tzinfo else value.replace(tzinfo=UTC)
    return aware.astimezone(MOSCOW).date().isoformat()


def _counts(counter: Counter, keys: list[str]) -> list[Count]:
    return [Count(key=key, count=counter.get(key, 0)) for key in keys]


def board_stats(leads: list[Lead], now: datetime | None = None) -> StatsOut:
    now = now or datetime.now(UTC)
    today = now.astimezone(MOSCOW).date()
    days = [(today - timedelta(days=offset)).isoformat() for offset in range(DAYS - 1, -1, -1)]

    done = [lead for lead in leads if lead.triage]
    is_spam = {lead.id: lead.triage["type"] == "spam" for lead in done}
    per_day: Counter = Counter()
    spam_per_day: Counter = Counter()
    for lead in leads:
        day = _local_day(lead.created_at)
        per_day[day] += 1
        spam_per_day[day] += is_spam.get(lead.id, False)

    # Время разбора — только настоящие обращения к нейросети, без правил и ответов из кеша
    timings = [
        lead.elapsed_ms
        for lead in done
        if lead.method == "ai" and lead.elapsed_ms and lead.elapsed_ms >= CACHED_MS
    ]
    spam = sum(is_spam.values())
    return StatsOut(
        total=len(leads),
        week_total=sum(per_day[day] for day in days),
        week_spam=sum(spam_per_day[day] for day in days),
        spam_share=spam / len(done) if done else 0.0,
        urgent_open=sum(
            1 for lead in done if lead.triage["notify"] and lead.status not in {"closed", "spam"}
        ),
        avg_triage_ms=round(sum(timings) / len(timings)) if timings else None,
        edited_share=sum(1 for lead in done if lead.edited) / len(done) if done else 0.0,
        by_day=[DayCount(date=day, total=per_day[day], spam=spam_per_day[day]) for day in days],
        by_type=_counts(Counter(lead.triage["type"] for lead in done), TYPES),
        by_channel=_counts(Counter(lead.channel for lead in leads), CHANNELS),
        by_status=_counts(Counter(lead.status for lead in leads), COLUMNS),
    )
