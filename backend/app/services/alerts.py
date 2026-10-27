"""Уведомления о срочных заявках в привязанные чаты Telegram."""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models import Lead, TelegramChat
from app.services.telegram import TelegramError, get_telegram, lead_buttons, lead_text

log = logging.getLogger(__name__)

SOURCES = {"form": "с сайта", "manual": "добавлена вручную", "telegram": "из Telegram"}


async def notify_urgent(sessions: async_sessionmaker, lead_id: str) -> None:
    """Срочная заявка → сообщение с кнопками во все чаты, привязанные к доске.

    Ошибки Telegram не мешают разбору: заявка уже на доске, уведомление — бонус.
    """
    tg = get_telegram()
    if tg is None:
        return
    async with sessions() as session:
        lead = await session.get(Lead, lead_id)
        if lead is None or not lead.triage or not lead.triage["notify"]:
            return
        chats = list(
            await session.scalars(
                select(TelegramChat.chat_id).where(TelegramChat.visitor_id == lead.visitor_id)
            )
        )
        text = lead_text(lead.triage, f"Срочная заявка {SOURCES[lead.channel]}")
        buttons = lead_buttons(lead.id, lead.status, moves=True)
    for chat_id in chats:
        try:
            await tg.send(chat_id, text, buttons)
        except TelegramError as e:
            log.warning("Уведомление о заявке %s в чат %s не ушло: %s", lead_id, chat_id, e)
