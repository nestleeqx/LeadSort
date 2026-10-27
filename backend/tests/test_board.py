from collections import Counter

from app.config import get_settings
from app.services.demo import cleanup_old
from tests.conftest import drain


async def _board(client) -> list[dict]:
    resp = await client.get("/api/leads")
    assert resp.status_code == 200
    return resp.json()["leads"]


def _by_demo(leads: list[dict], demo_id: str) -> dict:
    return next(lead for lead in leads if lead["demo_id"] == demo_id)


async def test_first_visit_gets_demo_board(client):
    leads = await _board(client)
    assert len(leads) == 25
    assert all(lead["state"] == "done" and lead["triage"] for lead in leads)
    columns = Counter(lead["status"] for lead in leads)
    assert set(columns) == {"new", "in_progress", "waiting", "closed", "spam"}
    # Спам — только в своей колонке
    assert all((lead["status"] == "spam") == (lead["triage"]["type"] == "spam") for lead in leads)
    # Второй запрос не создаёт демо заново
    assert len(await _board(client)) == 25


async def test_visitors_have_separate_boards(client):
    await _board(client)
    other = await client.get("/api/leads", headers={"X-Visitor-Id": "other-visitor-02"})
    lead = other.json()["leads"][0]
    resp = await client.get(f"/api/leads/{lead['id']}")
    assert resp.status_code == 404


async def test_bad_visitor_id_is_rejected(client):
    resp = await client.get("/api/leads", headers={"X-Visitor-Id": "x"})
    assert resp.status_code == 400


async def test_manual_lead_is_triaged_in_background(client):
    await _board(client)
    resp = await client.post(
        "/api/leads",
        json={"text": "Сайт не открывается с утра, срочно! Анна, 8 916 123-45-67"},
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["state"] in {"queued", "running"} and created["status"] == "new"
    await drain()

    leads = await _board(client)
    lead = next(item for item in leads if item["id"] == created["id"])
    assert lead["state"] == "done"
    assert lead["triage"]["type"] == "support" and lead["triage"]["notify"]
    assert lead["triage"]["contacts"]["phones"] == ["+7 (916) 123-45-67"]
    # Новая заявка — наверху колонки
    new_column = [item for item in leads if item["status"] == "new"]
    assert min(new_column, key=lambda item: item["position"])["id"] == created["id"]

    detail = (await client.get(f"/api/leads/{created['id']}")).json()
    texts = [event["text"] for event in detail["events"]]
    assert texts[0] == "Заявка получена: добавлена вручную"
    assert texts[1].startswith("Разобрана")


async def test_spam_goes_to_spam_column_automatically(client):
    await _board(client)
    created = (
        await client.post(
            "/api/leads", json={"text": "Выведем ваш сайт в ТОП Яндекса, SEO продвижение недорого"}
        )
    ).json()
    await drain()
    lead = (await client.get(f"/api/leads/{created['id']}")).json()
    assert lead["status"] == "spam" and not lead["triage"]["notify"]
    assert "Отправлена в спам автоматически" in [e["text"] for e in lead["events"]]


async def test_empty_text_is_rejected(client):
    resp = await client.post("/api/leads", json={"text": "   "})
    assert resp.status_code == 422


async def test_move_between_columns(client):
    lead = _by_demo(await _board(client), "L01")
    resp = await client.patch(
        f"/api/leads/{lead['id']}", json={"status": "in_progress", "position": -5}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress" and resp.json()["position"] == -5
    detail = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert detail["events"][-1]["text"] == "Перенесена в «В работе»"


async def test_restore_from_spam_changes_type(client):
    spam = _by_demo(await _board(client), "L05")
    resp = await client.patch(f"/api/leads/{spam['id']}", json={"status": "new", "position": 0})
    lead = resp.json()
    assert lead["status"] == "new"
    assert lead["triage"]["type"] == "question" and "type" in lead["edited"]


async def test_moving_to_spam_marks_as_spam(client):
    lead = _by_demo(await _board(client), "L02")
    assert lead["triage"]["notify"]
    moved = (
        await client.patch(f"/api/leads/{lead['id']}", json={"status": "spam", "position": 0})
    ).json()
    assert moved["triage"]["type"] == "spam" and not moved["triage"]["notify"]


async def test_edit_fields_by_hand(client):
    lead = _by_demo(await _board(client), "L01")
    resp = await client.patch(
        f"/api/leads/{lead['id']}/triage",
        json={"budget": "до 250 тыс. ₽", "urgency": "high", "missing": ["Есть ли логотип?", " "]},
    )
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["triage"]["budget"] == "до 250 тыс. ₽"
    assert detail["triage"]["notify"] is True
    assert detail["triage"]["missing"] == ["Есть ли логотип?"]
    assert set(detail["edited"]) == {"budget", "urgency", "missing"}
    assert detail["events"][-1]["text"] == "Поправлено вручную: срочность, бюджет, вопросы клиенту"


async def test_changing_type_to_spam_moves_card(client):
    lead = _by_demo(await _board(client), "L04")
    detail = (await client.patch(f"/api/leads/{lead['id']}/triage", json={"type": "spam"})).json()
    assert detail["status"] == "spam"


async def test_unchanged_edit_writes_nothing(client):
    lead = _by_demo(await _board(client), "L01")
    before = (await client.get(f"/api/leads/{lead['id']}")).json()
    detail = (
        await client.patch(
            f"/api/leads/{lead['id']}/triage", json={"budget": lead["triage"]["budget"]}
        )
    ).json()
    assert detail["edited"] == [] and len(detail["events"]) == len(before["events"])


async def test_retriage_replaces_manual_edits(client):
    lead = _by_demo(await _board(client), "L02")
    await client.patch(f"/api/leads/{lead['id']}/triage", json={"budget": "миллион"})
    resp = await client.post(f"/api/leads/{lead['id']}/retriage")
    assert resp.status_code == 200
    await drain()
    detail = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert detail["state"] == "done" and detail["edited"] == []
    assert detail["triage"]["budget"] != "миллион"


async def test_retriage_asks_model_again(client, redis):
    resp = await client.post("/api/leads", json={"text": "Нужен лендинг для кофейни к весне"})
    lead_id = resp.json()["id"]
    await drain()
    # Ответ модели уже в кеше; «Разобрать заново» всё равно должен её спросить
    cached = await redis.keys("leadsort:llm:*")
    assert cached
    for key in cached:
        await redis.set(key, "испорчено")
    await client.post(f"/api/leads/{lead_id}/retriage")
    await drain()
    detail = (await client.get(f"/api/leads/{lead_id}")).json()
    assert detail["state"] == "done"
    assert not await redis.keys("leadsort:fresh:*")


async def test_reset_demo_restores_board(client):
    leads = await _board(client)
    await client.patch(f"/api/leads/{leads[0]['id']}", json={"status": "closed", "position": 0})
    await client.post("/api/leads", json={"text": "Нужен лендинг для кофейни"})
    await drain()
    resp = await client.post("/api/demo/reset")
    assert resp.status_code == 200
    after = resp.json()["leads"]
    assert len(after) == 25 and all(lead["demo_id"] for lead in after)


async def test_cleanup_removes_idle_boards(client):
    from app.db import SessionLocal

    await _board(client)
    async with SessionLocal() as session:
        assert await cleanup_old(session, get_settings().board_ttl_hours) == 0
        assert await cleanup_old(session, -1) == 1
    # Следующий визит получает свежее демо
    assert len(await _board(client)) == 25


async def test_cron_needs_secret(client):
    assert (await client.get("/api/cron/cleanup")).status_code == 401


async def test_poll_mode_triages_while_board_is_polled(client):
    """На Vercel нет фоновых процессов: заявку разбирает следующий опрос доски."""
    from app.db import SessionLocal
    from app.main import app
    from app.services.processing import PollQueue
    from app.services.redis_store import get_redis

    app.state.queue = PollQueue(SessionLocal, app.state.provider, get_redis())
    await _board(client)
    created = (await client.post("/api/leads", json={"text": "Нужен лендинг к пятнице"})).json()
    assert created["state"] == "queued"
    lead = next(item for item in await _board(client) if item["id"] == created["id"])
    assert lead["state"] == "done" and lead["triage"]["type"] == "new_site"


async def test_move_without_position_puts_card_on_top(client):
    leads = await _board(client)
    lead = _by_demo(leads, "L01")
    top = min(item["position"] for item in leads if item["status"] == "closed")
    moved = (await client.patch(f"/api/leads/{lead['id']}", json={"status": "closed"})).json()
    assert moved["status"] == "closed" and moved["position"] < top


async def test_form_lead_lands_on_board_triaged(client):
    resp = await client.post(
        "/api/form",
        json={
            "name": "Ольга",
            "contact": "8 916 700 12 34",
            "message": "Сайт не открывается с утра, срочно нужна помощь!",
        },
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["channel"] == "form" and created["state"] in {"queued", "running"}
    assert created["text"].startswith("Имя: Ольга\nКонтакт: 8 916 700 12 34\n\n")
    await drain()

    lead = (await client.get(f"/api/leads/{created['id']}")).json()
    assert lead["state"] == "done" and lead["status"] == "new"
    assert lead["triage"]["type"] == "support" and lead["triage"]["notify"]
    assert lead["triage"]["contacts"]["phones"] == ["+7 (916) 700-12-34"]
    assert lead["events"][0]["text"] == "Заявка получена: форма на сайте"
    # Первая заявка посетителя — его демо-доска создаётся тут же
    assert len(await _board(client)) == 26


async def test_form_with_contact_only_is_accepted(client):
    resp = await client.post("/api/form", json={"name": "Иван", "contact": "+79161234567"})
    assert resp.status_code == 201
    await drain()
    lead = (await client.get(f"/api/leads/{resp.json()['id']}")).json()
    assert lead["method"] == "rules" and lead["triage"]["type"] == "question"
    assert lead["triage"]["contacts"]["name"] == "Иван"
    assert {h["kind"] for h in lead["highlights"]} == {"name", "phone"}


async def test_empty_form_is_rejected(client):
    resp = await client.post("/api/form", json={"name": "Иван", "contact": " ", "message": ""})
    assert resp.status_code == 422 and "контакт" in resp.json()["detail"]


async def test_form_page_polling_triages_in_poll_mode(client):
    """На Vercel страница формы опрашивает заявку — этот опрос её и разбирает."""
    from app.db import SessionLocal
    from app.main import app
    from app.services.processing import PollQueue
    from app.services.redis_store import get_redis

    app.state.queue = PollQueue(SessionLocal, app.state.provider, get_redis())
    created = (
        await client.post("/api/form", json={"message": "Нужен лендинг для кофейни к весне"})
    ).json()
    lead = (await client.get(f"/api/leads/{created['id']}")).json()
    assert lead["state"] == "done" and lead["triage"]["type"] == "new_site"
