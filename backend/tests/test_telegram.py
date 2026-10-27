import pytest

from app.config import get_settings
from app.services.prompts import triage_prompt
from app.services.telegram import TelegramClient, set_telegram
from tests.conftest import drain

CHAT = 555


class FakeTelegram(TelegramClient):
    """Вместо Telegram: запоминает вызовы и отвечает как Bot API."""

    def __init__(self):
        self.calls: list[tuple[str, dict]] = []
        self._message_id = 100

    async def call(self, method, **params):
        self.calls.append((method, params))
        if method == "getMe":
            return {"username": "pixel_demo_bot"}
        if method == "sendMessage":
            self._message_id += 1
            return {"message_id": self._message_id}
        return True

    async def aclose(self):
        pass

    def of(self, method: str) -> list[dict]:
        return [params for name, params in self.calls if name == method]


@pytest.fixture
def tg(client):
    settings = get_settings()
    settings.telegram_bot_token = "123:test"
    fake = FakeTelegram()
    set_telegram(fake)
    yield fake
    settings.telegram_bot_token = ""
    set_telegram(None)


def _message(text: str, chat_id: int = CHAT, username: str | None = "anna_client") -> dict:
    sender = {"id": chat_id, "first_name": "Анна", **({"username": username} if username else {})}
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "chat": {"id": chat_id, "type": "private", "first_name": "Анна"},
            "from": sender,
            "text": text,
        },
    }


async def _update(client, update: dict, secret: str | None = None):
    secret = get_settings().telegram_webhook_secret if secret is None else secret
    return await client.post(
        "/api/telegram/webhook", json=update, headers={"X-Telegram-Bot-Api-Secret-Token": secret}
    )


async def _link(client, chat_id: int = CHAT) -> None:
    url = (await client.post("/api/telegram/link")).json()["url"]
    assert url.startswith("https://t.me/pixel_demo_bot?start=")
    await _update(client, _message(f"/start {url.split('start=')[1]}", chat_id))


async def _leads(client) -> list[dict]:
    return (await client.get("/api/leads")).json()["leads"]


async def test_bot_is_off_without_token(client):
    resp = await client.get("/api/telegram")
    assert resp.json() == {"enabled": False, "chats": []}
    assert (await client.post("/api/telegram/link")).status_code == 503


async def test_deep_link_binds_chat_to_board(client, tg):
    await _link(client)
    assert (await client.get("/api/telegram")).json() == {"enabled": True, "chats": ["Анна"]}
    assert tg.of("sendMessage")[-1]["text"].startswith("Готово!")


async def test_link_token_works_once(client, tg):
    url = (await client.post("/api/telegram/link")).json()["url"]
    token = url.split("start=")[1]
    await _update(client, _message(f"/start {token}"))
    await _update(client, _message(f"/start {token}", chat_id=777))
    assert "устарела" in tg.of("sendMessage")[-1]["text"]


async def test_message_in_linked_chat_becomes_triaged_lead(client, tg):
    await _link(client)
    await _update(client, _message("Нужен лендинг для кофейни к весне, бюджет до 100 тысяч"))
    lead = next(
        lead
        for lead in await _leads(client)
        if lead["channel"] == "telegram" and not lead["demo_id"]
    )
    assert lead["state"] == "done" and lead["status"] == "new"
    # Ник отправителя — контакт клиента
    assert "@anna_client" in lead["text"]
    assert "anna_client" in lead["triage"]["contacts"]["telegram"][0]
    # Сначала «разбираю», потом это же сообщение заменяется разбором с кнопками
    assert tg.of("sendMessage")[-1]["text"].startswith("⏳")
    edited = tg.of("editMessageText")[-1]
    assert "Заявка на доске" in edited["text"]
    buttons = edited["reply_markup"]["inline_keyboard"][0]
    assert [b["callback_data"] for b in buttons] == [
        f"mv:{lead['id']}:in_progress",
        f"mv:{lead['id']}:waiting",
    ]


async def test_unlinked_chat_gets_studio_reply(client, tg):
    before = len(await _leads(client))
    await _update(client, _message("Сколько стоит сайт?"))
    assert "Подключить Telegram" in tg.of("sendMessage")[-1]["text"]
    assert len(await _leads(client)) == before


async def test_urgent_form_lead_is_sent_to_linked_chat(client, tg):
    await _link(client)
    sent = len(tg.of("sendMessage"))
    await client.post("/api/form", json={"message": "Нужен лендинг для кофейни к весне"})
    await drain()
    assert len(tg.of("sendMessage")) == sent

    resp = await client.post(
        "/api/form",
        json={
            "name": "Олег",
            "contact": "+7 916 123-45-67",
            "message": "Сайт не открывается, срочно!",
        },
    )
    await drain()
    alert = tg.of("sendMessage")[-1]
    assert alert["chat_id"] == CHAT and "Срочная заявка с сайта" in alert["text"]
    lead_id = resp.json()["id"]
    assert (
        alert["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
        == f"mv:{lead_id}:in_progress"
    )

    # «Разобрать заново» не присылает уведомление повторно
    sent = len(tg.of("sendMessage"))
    await client.post(f"/api/leads/{lead_id}/retriage")
    await drain()
    assert len(tg.of("sendMessage")) == sent


async def test_button_moves_lead_on_board(client, tg):
    await _link(client)
    lead = next(lead for lead in await _leads(client) if lead["status"] == "new")
    press = {
        "update_id": 2,
        "callback_query": {
            "id": "q1",
            "data": f"mv:{lead['id']}:in_progress",
            "message": {"message_id": 50, "chat": {"id": CHAT}},
        },
    }
    await _update(client, press)
    moved = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert moved["status"] == "in_progress"
    assert tg.of("answerCallbackQuery")[-1]["text"] == "Перенесена в «В работе»"
    assert tg.of("editMessageReplyMarkup")[-1]["reply_markup"]["inline_keyboard"][0][0]["text"] == (
        "✓ В работе"
    )

    # Повторное нажатие ничего не двигает
    press["callback_query"]["data"] = f"mv:{lead['id']}:waiting"
    await _update(client, press)
    assert (await client.get(f"/api/leads/{lead['id']}")).json()["status"] == "in_progress"
    assert "уже в колонке «В работе»" in tg.of("answerCallbackQuery")[-1]["text"]


async def test_button_from_foreign_chat_does_nothing(client, tg):
    lead = next(lead for lead in await _leads(client) if lead["status"] == "new")
    press = {
        "update_id": 3,
        "callback_query": {
            "id": "q2",
            "data": f"mv:{lead['id']}:in_progress",
            "message": {"message_id": 51, "chat": {"id": 999}},
        },
    }
    await _update(client, press)
    assert (await client.get(f"/api/leads/{lead['id']}")).json()["status"] == "new"


async def test_stop_and_unlink(client, tg):
    await _link(client)
    await _update(client, _message("/stop"))
    assert (await client.get("/api/telegram")).json()["chats"] == []

    await _link(client)
    resp = await client.delete("/api/telegram/link")
    assert resp.json()["chats"] == []
    assert "отключён" in tg.of("sendMessage")[-1]["text"]


async def test_webhook_needs_secret(client, tg):
    resp = await _update(client, _message("привет"), secret="wrong")
    assert resp.status_code == 403
    assert tg.calls == []


async def test_webhook_is_set_on_vercel_once(client, tg):
    settings = get_settings()
    settings.vercel = True
    try:
        for _ in range(2):
            await client.get(
                "/api/telegram", headers={"X-Forwarded-Host": "leadsort-api.vercel.app"}
            )
    finally:
        settings.vercel = False
    calls = tg.of("setWebhook")
    assert len(calls) == 1
    assert calls[0]["url"] == "https://leadsort-api.vercel.app/api/telegram/webhook"
    assert calls[0]["secret_token"] == settings.telegram_webhook_secret


def test_prompt_knows_telegram_channel():
    _, user = triage_prompt("Нужен сайт", channel="telegram")
    assert "не спрашивай, как связаться" in user
    _, user = triage_prompt("Нужен сайт")
    assert "Telegram" not in user
