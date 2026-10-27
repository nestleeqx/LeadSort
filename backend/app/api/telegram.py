import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import delete, select

from app.config import get_settings
from app.db import SessionLocal
from app.deps import RedisDep, SessionDep, VisitorDep
from app.models import TelegramChat
from app.schemas import TelegramLink, TelegramStatus
from app.services.bot import UNLINKED, Bot, bot_username, create_link_token, ensure_webhook
from app.services.demo import ensure_visitor
from app.services.telegram import TelegramClient, TelegramError, get_telegram

router = APIRouter(prefix="/api/telegram", tags=["telegram"])
log = logging.getLogger(__name__)

NOT_READY = "Telegram-бот сейчас недоступен. Попробуйте позже."


def _client() -> TelegramClient:
    tg = get_telegram()
    if tg is None:
        raise HTTPException(503, NOT_READY)
    return tg


@router.get("", response_model=TelegramStatus)
async def status(request: Request, session: SessionDep, visitor: VisitorDep, redis: RedisDep):
    tg = get_telegram()
    if tg is None:
        return TelegramStatus(enabled=False)
    try:
        # Заодно проверяем, что Telegram отвечает, и на Vercel ставим вебхук
        await bot_username(redis, tg)
        host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
        await ensure_webhook(redis, tg, host)
    except TelegramError as e:
        log.warning("Telegram: %s", e)
        return TelegramStatus(enabled=False)
    chats = await session.scalars(
        select(TelegramChat.title)
        .where(TelegramChat.visitor_id == visitor)
        .order_by(TelegramChat.linked_at)
    )
    return TelegramStatus(enabled=True, chats=list(chats))


@router.post("/link", response_model=TelegramLink)
async def link(session: SessionDep, visitor: VisitorDep, redis: RedisDep):
    """Ссылка на бота с одноразовым токеном: по ней чат привяжется к доске посетителя."""
    tg = _client()
    await ensure_visitor(session, visitor)
    try:
        username = await bot_username(redis, tg)
    except TelegramError as e:
        log.warning("Telegram: %s", e)
        raise HTTPException(503, NOT_READY) from e
    token = await create_link_token(redis, visitor)
    return TelegramLink(url=f"https://t.me/{username}?start={token}")


@router.delete("/link", response_model=TelegramStatus)
async def unlink(session: SessionDep, visitor: VisitorDep):
    tg = _client()
    chats = list(
        await session.scalars(
            select(TelegramChat.chat_id).where(TelegramChat.visitor_id == visitor)
        )
    )
    await session.execute(delete(TelegramChat).where(TelegramChat.visitor_id == visitor))
    await session.commit()
    for chat_id in chats:
        try:
            await tg.send(chat_id, UNLINKED)
        except TelegramError as e:
            log.warning("Telegram: %s", e)
    return TelegramStatus(enabled=True)


@router.post("/webhook")
async def webhook(
    request: Request,
    redis: RedisDep,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    """Обновления от Telegram на Vercel. Секрет в заголовке отличает их от чужих запросов."""
    tg = get_telegram()
    secret = get_settings().telegram_webhook_secret
    if tg is None or not hmac.compare_digest(x_telegram_bot_api_secret_token or "", secret):
        raise HTTPException(403, "Нет доступа")
    update = await request.json()
    # Ошибку разбора одного сообщения не возвращаем Telegram: иначе он будет слать его снова
    try:
        await Bot(SessionLocal, request.app.state.provider, redis, tg).handle(update)
    except Exception:
        log.exception("Telegram: не удалось обработать обновление")
    return {"ok": True}
