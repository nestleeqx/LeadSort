"""Клиент Telegram Bot API: несколько методов поверх httpx, без отдельной библиотеки."""

import logging
from html import escape
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

Buttons = list[list[dict[str, str]]]


class TelegramError(Exception):
    pass


class TelegramClient:
    def __init__(self, token: str, http: httpx.AsyncClient | None = None):
        self._base = f"https://api.telegram.org/bot{token}/"
        self._http = http or httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=10.0))

    async def call(self, method: str, **params: Any) -> Any:
        payload = {k: v for k, v in params.items() if v is not None}
        try:
            resp = await self._http.post(self._base + method, json=payload)
            data = resp.json()
        except (httpx.HTTPError, ValueError) as e:
            # from None: в тексте исходной ошибки httpx — адрес запроса с токеном бота
            raise TelegramError(f"{method}: Telegram недоступен ({e.__class__.__name__})") from None
        if not data.get("ok"):
            raise TelegramError(f"{method}: {data.get('description', resp.status_code)}")
        return data["result"]

    async def send(self, chat_id: int, text: str, buttons: Buttons | None = None) -> dict:
        return await self.call(
            "sendMessage",
            chat_id=chat_id,
            text=text,
            parse_mode="HTML",
            link_preview_options={"is_disabled": True},
            reply_markup={"inline_keyboard": buttons} if buttons else None,
        )

    async def edit(
        self, chat_id: int, message_id: int, text: str, buttons: Buttons | None = None
    ) -> None:
        await self.call(
            "editMessageText",
            chat_id=chat_id,
            message_id=message_id,
            text=text,
            parse_mode="HTML",
            link_preview_options={"is_disabled": True},
            reply_markup={"inline_keyboard": buttons} if buttons else None,
        )

    async def edit_buttons(self, chat_id: int, message_id: int, buttons: Buttons) -> None:
        await self.call(
            "editMessageReplyMarkup",
            chat_id=chat_id,
            message_id=message_id,
            reply_markup={"inline_keyboard": buttons},
        )

    async def answer(self, callback_id: str, text: str) -> None:
        await self.call("answerCallbackQuery", callback_query_id=callback_id, text=text)

    async def aclose(self) -> None:
        await self._http.aclose()


_client: TelegramClient | None = None


def get_telegram() -> TelegramClient | None:
    """Клиент бота или None, если токен не задан."""
    global _client
    token = get_settings().telegram_bot_token
    if not token:
        return None
    if _client is None:
        _client = TelegramClient(token)
    return _client


def set_telegram(client: TelegramClient | None) -> None:
    global _client
    _client = client


# --- Тексты сообщений ---

TYPES = {
    "new_site": "Новый сайт",
    "improvement": "Доработка",
    "support": "Поддержка",
    "question": "Вопрос",
    "spam": "Спам",
}
URGENCY = {"high": "🔴 Срочная", "medium": "🟡 Средняя срочность", "low": "⚪ Не срочная"}
MOVES = {"in_progress": "Взять в работу", "waiting": "Ждём клиента"}


def lead_url(lead_id: str) -> str | None:
    """Ссылка на карточку. Telegram принимает в кнопках только https — локально кнопки нет."""
    url = f"{get_settings().public_site_url}/app?lead={lead_id}"
    return url if url.startswith("https://") else None


def lead_text(triage: dict[str, Any], header: str) -> str:
    """Разбор заявки сообщением: тип и срочность, суть, контакты, бюджет и сроки."""
    t, c = triage, triage["contacts"]
    contacts = [c["name"], *c["phones"], *c["emails"], *c["telegram"]]
    lines = [
        f"<b>{escape(header)}</b>",
        f"{TYPES[t['type']]} · {URGENCY[t['urgency']]}",
        "",
        escape(t["summary"]),
    ]
    if t["type"] != "spam":
        facts = [
            ("Контакты", ", ".join(x for x in contacts if x) or "нет"),
            ("Бюджет", t["budget"]),
            ("Сроки", t["deadline"]),
        ]
        lines += ["", *(f"{name}: {escape(value)}" for name, value in facts)]
    return "\n".join(lines)


def lead_buttons(lead_id: str, status: str, moves: bool) -> Buttons:
    """Кнопки под заявкой: перенос по колонкам (пока заявка в «Новой») и ссылка на доску."""
    rows: Buttons = []
    if moves and status == "new":
        rows.append(
            [{"text": label, "callback_data": f"mv:{lead_id}:{s}"} for s, label in MOVES.items()]
        )
    url = lead_url(lead_id)
    if url:
        rows.append([{"text": "Открыть на доске", "url": url}])
    return rows
