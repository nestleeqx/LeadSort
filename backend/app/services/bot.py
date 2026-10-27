"""Telegram-бот студии: привязка чата к доске, заявки из сообщений, кнопки под уведомлениями.

Обновления приходят одинаково из вебхука (Vercel) и из опроса (локально, сервис bot).
"""

import logging
import secrets
from dataclasses import dataclass
from typing import Any

from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import get_settings
from app.llm import LLMProvider
from app.models import Lead, TelegramChat, Visitor
from app.services.demo import ensure_visitor
from app.services.leads import COLUMNS, create_lead, form_text, move_lead
from app.services.processing import process_now
from app.services.redis_store import PREFIX, RateLimitExceeded, hit_limit
from app.services.telegram import (
    MOVES,
    TelegramClient,
    TelegramError,
    lead_buttons,
    lead_text,
    lead_url,
)

log = logging.getLogger(__name__)

LINK_TTL = 30 * 60


def _board() -> str:
    return f"{get_settings().public_site_url}/app"


def studio_reply() -> str:
    return (
        "Здравствуйте! Это демо-бот сервиса <b>LeadSort</b>: он разбирает заявки нейросетью "
        "для веб-студии «Пиксель».\n\n"
        "Чтобы ваши сообщения попадали на доску как заявки, а срочные заявки приходили сюда, "
        f"откройте демо-доску и нажмите «Подключить Telegram»:\n{_board()}"
    )


HELP = (
    "Чат подключён к демо-доске студии «Пиксель».\n\n"
    "• Напишите сюда текст заявки — как будто вы клиент студии. Нейросеть разберёт его "
    "за несколько секунд, и заявка появится на доске в колонке «Новая».\n"
    "• Срочные заявки с сайта студии тоже придут сюда — с кнопками «Взять в работу» "
    "и «Ждём клиента».\n\n"
    "/stop — отключить чат от доски."
)
LINK_EXPIRED = (
    "Ссылка устарела или уже использована. Откройте доску, нажмите «Подключить Telegram» "
    "и перейдите по новой ссылке."
)
UNLINKED = "Чат отключён от доски. Подключить снова — кнопкой «Подключить Telegram» на доске."
TEXT_ONLY = "Заявки принимаю только текстом — опишите задачу словами."
WORKING = "⏳ Заявка принята — нейросеть разбирает…"
FAILED = "Не удалось разобрать заявку. Она уже на доске — нажмите «Разобрать заново» в карточке."
LEAD_GONE = "Заявка не найдена — возможно, демо-доску сбросили."


def _link_key(token: str) -> str:
    return f"{PREFIX}tg:link:{token}"


async def create_link_token(redis: Redis, visitor_id: str) -> str:
    """Одноразовый токен для ссылки t.me/<бот>?start=<токен>: по нему чат найдёт доску."""
    token = secrets.token_urlsafe(16)
    await redis.set(_link_key(token), visitor_id, ex=LINK_TTL)
    return token


async def bot_username(redis: Redis, tg: TelegramClient) -> str:
    """Имя бота для ссылок — из getMe, с кешем на сутки."""
    key = f"{PREFIX}tg:me:{get_settings().telegram_webhook_secret[:12]}"
    cached = await redis.get(key)
    if cached:
        return cached
    me = await tg.call("getMe")
    await redis.set(key, me["username"], ex=24 * 3600)
    return me["username"]


async def ensure_webhook(redis: Redis, tg: TelegramClient, host: str = "") -> None:
    """На Vercel ставит вебхук на постоянный адрес проекта и раз в час проверяет его.

    host — адрес, на который пришёл запрос: запасной вариант, если Vercel не передал свой.
    """
    s = get_settings()
    host = s.vercel_project_production_url or host
    if not s.vercel or not host:
        return
    url = f"https://{host}/api/telegram/webhook"
    key = f"{PREFIX}tg:webhook:{s.telegram_webhook_secret[:12]}"
    if await redis.get(key) == url:
        return
    await tg.call(
        "setWebhook",
        url=url,
        secret_token=s.telegram_webhook_secret,
        allowed_updates=["message", "callback_query"],
    )
    await redis.set(key, url, ex=3600)
    log.info("Вебхук Telegram: %s", url)


def _chat_title(chat: dict[str, Any]) -> str:
    if chat.get("title"):
        return chat["title"]
    name = " ".join(x for x in (chat.get("first_name"), chat.get("last_name")) if x)
    return name or (f"@{chat['username']}" if chat.get("username") else "чат Telegram")


@dataclass
class Bot:
    sessions: async_sessionmaker
    provider: LLMProvider
    redis: Redis
    tg: TelegramClient

    async def handle(self, update: dict[str, Any]) -> None:
        try:
            if "callback_query" in update:
                await self._on_button(update["callback_query"])
            elif "message" in update:
                await self._on_message(update["message"])
        except TelegramError as e:
            log.warning("Telegram: %s", e)

    async def _visitor(self, chat_id: int) -> str | None:
        async with self.sessions() as session:
            return await session.scalar(
                select(TelegramChat.visitor_id).where(TelegramChat.chat_id == chat_id)
            )

    async def _on_message(self, msg: dict[str, Any]) -> None:
        chat = msg["chat"]
        chat_id = chat["id"]
        text = (msg.get("text") or "").strip()
        command, _, arg = text.partition(" ")
        # В группах команда приходит как /start@имя_бота
        command = command.split("@")[0].lower() if command.startswith("/") else ""

        if command == "/start" and arg:
            await self._link(chat, arg.strip())
            return
        visitor = await self._visitor(chat_id)
        if command == "/stop":
            await self._unlink(chat_id, visitor)
        elif command:
            await self.tg.send(chat_id, HELP if visitor else studio_reply())
        elif visitor is None:
            await self.tg.send(chat_id, studio_reply())
        elif not text:
            await self.tg.send(chat_id, TEXT_ONLY)
        else:
            await self._new_lead(chat_id, visitor, text, msg.get("from") or {})

    async def _link(self, chat: dict[str, Any], token: str) -> None:
        visitor = await self.redis.getdel(_link_key(token))
        async with self.sessions() as session:
            if visitor is None or await session.get(Visitor, visitor) is None:
                await self.tg.send(chat["id"], LINK_EXPIRED)
                return
            row = await session.get(TelegramChat, chat["id"])
            if row is None:
                session.add(
                    TelegramChat(chat_id=chat["id"], visitor_id=visitor, title=_chat_title(chat))
                )
            else:
                # Чат уже был привязан к другой доске — теперь он принадлежит этой
                row.visitor_id, row.title = visitor, _chat_title(chat)
            await session.commit()
        await self.tg.send(chat["id"], "Готово! " + HELP)

    async def _unlink(self, chat_id: int, visitor: str | None) -> None:
        if visitor is None:
            await self.tg.send(chat_id, studio_reply())
            return
        async with self.sessions() as session:
            await session.execute(delete(TelegramChat).where(TelegramChat.chat_id == chat_id))
            await session.commit()
        await self.tg.send(chat_id, UNLINKED)

    async def _new_lead(
        self, chat_id: int, visitor: str, text: str, sender: dict[str, Any]
    ) -> None:
        s = get_settings()
        if len(text) > s.max_lead_chars:
            await self.tg.send(
                chat_id, f"Сообщение длиннее {s.max_lead_chars} символов — сократите его."
            )
            return
        try:
            await hit_limit(self.redis, "triage", f"tg:{chat_id}", s.triages_per_hour)
        except RateLimitExceeded as e:
            minutes = max(1, e.retry_after // 60)
            await self.tg.send(
                chat_id, f"Лимит демо: {e.limit} разборов в час. Попробуйте через {minutes} мин."
            )
            return

        # Ник отправителя — контакт клиента, как поле «Контакт» в форме на сайте
        username = sender.get("username")
        body = form_text("", f"@{username}" if username else "", text)
        async with self.sessions() as session:
            await ensure_visitor(session, visitor)
            lead = await create_lead(session, visitor, "telegram", body)
            await session.commit()
            lead_id = lead.id

        sent = await self.tg.send(chat_id, WORKING)
        await process_now(self.sessions, self.provider, self.redis, lead_id)
        async with self.sessions() as session:
            lead = await session.get(Lead, lead_id)
        if lead is None or lead.state != "done" or not lead.triage:
            url = lead_url(lead_id)
            buttons = [[{"text": "Открыть на доске", "url": url}]] if url else None
            await self.tg.edit(chat_id, sent["message_id"], FAILED, buttons)
            return
        spam = lead.triage["type"] == "spam"
        header = "Похоже на спам — заявка в колонке «Спам»" if spam else "Заявка на доске"
        await self.tg.edit(
            chat_id,
            sent["message_id"],
            lead_text(lead.triage, header),
            lead_buttons(lead.id, lead.status, moves=not spam),
        )

    async def _on_button(self, query: dict[str, Any]) -> None:
        data = query.get("data") or ""
        message = query.get("message") or {}
        chat_id = message.get("chat", {}).get("id")
        _, lead_id, status = (data.split(":") + ["", ""])[:3]
        if not data.startswith("mv:") or status not in MOVES or chat_id is None:
            await self.tg.answer(query["id"], "")
            return
        visitor = await self._visitor(chat_id)
        async with self.sessions() as session:
            lead = (
                await session.scalar(
                    select(Lead).where(Lead.id == lead_id, Lead.visitor_id == visitor)
                )
                if visitor
                else None
            )
            if lead is None:
                await self.tg.answer(query["id"], LEAD_GONE)
                return
            if lead.status == "new":
                await move_lead(session, lead, status, None)
                await session.commit()
                note = f"Перенесена в «{COLUMNS[status]}»"
            else:
                # Карточку уже передвинули на доске — кнопки устарели
                note = f"Заявка уже в колонке «{COLUMNS[lead.status]}»"
            done = lead.status
        await self.tg.answer(query["id"], note)
        url = lead_url(lead_id)
        rows = [[{"text": f"✓ {COLUMNS[done]}", "callback_data": "noop"}]]
        if url:
            rows.append([{"text": "Открыть на доске", "url": url}])
        await self.tg.edit_buttons(chat_id, message["message_id"], rows)
