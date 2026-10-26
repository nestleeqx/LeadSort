"""Выгрузка заявок в CSV — открывается в Excel и Google Таблицах без настройки."""

import csv
import io
from datetime import UTC

from app.models import Lead
from app.services.leads import CHANNELS, COLUMNS
from app.services.prompts import MOSCOW

TYPES = {
    "new_site": "Новый сайт",
    "improvement": "Доработка",
    "support": "Поддержка",
    "question": "Вопрос",
    "spam": "Спам",
}
URGENCY = {"high": "Высокая", "medium": "Средняя", "low": "Низкая"}

HEADER = [
    "Дата",
    "Канал",
    "Колонка",
    "Тип",
    "Срочность",
    "Причина срочности",
    "Имя",
    "Телефоны",
    "Почта",
    "Telegram",
    "Бюджет",
    "Сроки",
    "Резюме",
    "Вопросы клиенту",
    "Черновик ответа",
    "Исходный текст",
]


def _row(lead: Lead) -> list[str]:
    created = lead.created_at if lead.created_at.tzinfo else lead.created_at.replace(tzinfo=UTC)
    t = lead.triage or {}
    c = t.get("contacts", {})
    return [
        created.astimezone(MOSCOW).strftime("%d.%m.%Y %H:%M"),
        CHANNELS.get(lead.channel, lead.channel),
        COLUMNS.get(lead.status, lead.status),
        TYPES.get(t.get("type", ""), "ещё разбирается"),
        URGENCY.get(t.get("urgency", ""), ""),
        t.get("urgency_reason", ""),
        c.get("name", ""),
        ", ".join(c.get("phones", [])),
        ", ".join(c.get("emails", [])),
        ", ".join(c.get("telegram", [])),
        t.get("budget", ""),
        t.get("deadline", ""),
        t.get("summary", ""),
        "\n".join(t.get("missing", [])),
        t.get("reply_draft", ""),
        lead.text,
    ]


def leads_csv(leads: list[Lead]) -> str:
    """CSV с точкой с запятой и BOM: русский Excel так открывает его сразу по колонкам."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(HEADER)
    for lead in sorted(leads, key=lambda item: item.created_at, reverse=True):
        writer.writerow(_row(lead))
    return "﻿" + buffer.getvalue()
