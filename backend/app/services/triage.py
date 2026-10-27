"""Разбор заявки: правила → нейросеть → проверка результата кодом."""

import logging
import re
from dataclasses import dataclass

from redis.asyncio import Redis

from app.llm import LLMInvalidResponse, LLMProvider
from app.schemas import AiTriage, Contacts, Highlight, Triage
from app.services.contacts import (
    FoundContacts,
    email_in_text,
    find_contacts,
    name_spans,
    phone_in_text,
    telegram_in_text,
)
from app.services.prompts import triage_prompt
from app.services.redis_store import cached_complete

log = logging.getLogger(__name__)

MAX_MISSING = 4
NOT_SPECIFIED = "не указано"
# Шапка заявки с формы на сайте: «Имя: …», «Контакт: …»
FORM_HEADER = re.compile(r"^\s*(?:Имя|Контакт|Телефон|Почта|E-?mail|Telegram)\s*:.*$", re.M | re.I)
FORM_NAME = re.compile(r"^\s*Имя\s*:\s*(.+?)\s*$", re.M)
SIGNATURE = "Менеджер студии «Пиксель»"


@dataclass
class TriageResult:
    triage: Triage
    highlights: list[Highlight]
    notes: list[str]
    method: str


def _words_without_contacts(text: str, found: FoundContacts) -> str:
    """Текст заявки без найденных контактов — чтобы понять, есть ли в ней что-то кроме них."""
    spans = sorted((f.start, f.end) for f in [*found.phones, *found.emails, *found.telegram])
    parts, pos = [], 0
    for start, end in spans:
        parts.append(text[pos:start])
        pos = max(pos, end)
    parts.append(text[pos:])
    rest = FORM_HEADER.sub("", " ".join(parts))
    return " ".join(re.findall(r"[A-Za-zА-Яа-яЁё]{2,}", rest))


def _highlights(found: FoundContacts, name: str, text: str) -> list[Highlight]:
    items = [
        *(Highlight(start=f.start, end=f.end, kind="phone") for f in found.phones),
        *(Highlight(start=f.start, end=f.end, kind="email") for f in found.emails),
        *(Highlight(start=f.start, end=f.end, kind="telegram") for f in found.telegram),
    ]
    if name:
        items += [Highlight(start=s, end=e, kind="name") for s, e in name_spans(name, text)]
    # Пересечения убираем: подсветка в интерфейсе идёт подряд по тексту
    items.sort(key=lambda h: (h.start, -h.end))
    out: list[Highlight] = []
    for h in items:
        if not out or h.start >= out[-1].end:
            out.append(h)
    return out


def _by_rules(text: str, found: FoundContacts) -> Triage | None:
    """Заявки, для которых нейросеть не нужна: пустые и «только контакт»."""
    if len(re.sub(r"[\W_]", "", text)) < 2:
        return Triage(
            type="spam",
            urgency="low",
            urgency_reason="Пустое сообщение",
            contacts=Contacts(),
            budget=NOT_SPECIFIED,
            deadline=NOT_SPECIFIED,
            summary="Пустая заявка без текста и контактов.",
            missing=[],
            reply_draft="",
            notify=False,
        )
    has_contacts = found.phones or found.emails or found.telegram
    if has_contacts and len(_words_without_contacts(text, found)) < 12:
        return Triage(
            type="question",
            urgency="medium",
            urgency_reason="Оставили только контакт — нужно связаться и уточнить задачу",
            contacts=Contacts(
                name=name.group(1)[:80] if (name := FORM_NAME.search(text)) else "",
                phones=[f.value for f in found.phones],
                emails=[f.value for f in found.emails],
                telegram=[f.value for f in found.telegram],
            ),
            budget=NOT_SPECIFIED,
            deadline=NOT_SPECIFIED,
            summary="Клиент оставил только контакт, без описания задачи.",
            missing=["Какая задача: новый сайт, доработка или поддержка существующего?"],
            reply_draft=(
                "Здравствуйте! Спасибо, что оставили заявку в студии «Пиксель». Расскажите, "
                "пожалуйста, какая у вас задача: нужен новый сайт, доработка или поддержка "
                "существующего? Подскажем по срокам и стоимости.\n\nМенеджер студии «Пиксель»"
            ),
            notify=False,
        )
    return None


def _merge_contacts(ai: AiTriage, found: FoundContacts, text: str) -> tuple[Contacts, list[str]]:
    """Контакты = найденные регулярками + те, что нашла нейросеть и что есть в тексте."""
    notes: list[str] = []

    def merge(regex_values: list[str], ai_values: list[str], check, label: str) -> list[str]:
        out = list(regex_values)
        for raw in ai_values:
            value = check(raw, text)
            if value is None:
                if raw.strip():
                    notes.append(
                        f"Нейросеть указала {label} «{raw}», которого нет в тексте, — не добавлен."
                    )
                continue
            if value.lower() not in {v.lower() for v in out}:
                out.append(value)
        return out

    phones = merge([f.value for f in found.phones], ai.contacts.phones, phone_in_text, "телефон")
    emails = merge([f.value for f in found.emails], ai.contacts.emails, email_in_text, "адрес")
    telegram = merge(
        [f.value for f in found.telegram], ai.contacts.telegram, telegram_in_text, "ник"
    )
    name = ai.contacts.name.strip()
    if name and not name_spans(name, text):
        notes.append(f"Имени «{name}» нет в тексте — не подставлено.")
        name = ""
    return Contacts(name=name, phones=phones, emails=emails, telegram=telegram), notes


def _reply(draft: str) -> str:
    """Подпись — отдельным абзацем, даже если модель приклеила её к последней фразе."""
    draft = draft.strip()
    if draft.endswith(SIGNATURE):
        draft = draft.removesuffix(SIGNATURE).rstrip() + "\n\n" + SIGNATURE
    return draft


def _finish(ai: AiTriage, contacts: Contacts) -> Triage:
    spam = ai.type == "spam"
    urgency = "low" if spam else ai.urgency
    return Triage(
        type=ai.type,
        urgency=urgency,
        urgency_reason=ai.urgency_reason.strip(),
        contacts=contacts,
        budget=NOT_SPECIFIED if spam else ai.budget.strip() or NOT_SPECIFIED,
        deadline=NOT_SPECIFIED if spam else ai.deadline.strip() or NOT_SPECIFIED,
        summary=ai.summary.strip(),
        missing=[] if spam else [q.strip() for q in ai.missing if q.strip()][:MAX_MISSING],
        reply_draft="" if spam else _reply(ai.reply_draft),
        notify=urgency == "high" and not spam,
    )


async def _ask_model(
    provider: LLMProvider, redis: Redis, text: str, fresh: bool, channel: str | None
) -> AiTriage:
    system, user = triage_prompt(text, channel=channel)
    try:
        return await cached_complete(redis, provider, system, user, AiTriage, fresh=fresh)
    except LLMInvalidResponse as e:
        # Битый JSON бывает редко — один повторный запрос обычно его исправляет
        log.warning("Ответ модели не прошёл схему, повторяем: %s", e)
        return await provider.complete_json(system, user, AiTriage)


async def triage_lead(
    provider: LLMProvider,
    redis: Redis,
    text: str,
    fresh: bool = False,
    channel: str | None = None,
) -> TriageResult:
    """fresh — мимо кеша ответов модели: так работает «Разобрать заново».
    channel — откуда пришла заявка: из Telegram отвечают в тот же чат, контакт уже есть."""
    found = find_contacts(text)
    by_rules = _by_rules(text, found)
    if by_rules:
        highlights = _highlights(found, by_rules.contacts.name, text)
        return TriageResult(by_rules, highlights, [], "rules")

    ai = await _ask_model(provider, redis, text, fresh, channel)
    contacts, notes = _merge_contacts(ai, found, text)
    return TriageResult(_finish(ai, contacts), _highlights(found, contacts.name, text), notes, "ai")
