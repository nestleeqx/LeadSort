import csv
import io
from datetime import UTC, datetime, timedelta

from app.services.crm import parse_budget


async def _board(client) -> list[dict]:
    return (await client.get("/api/leads")).json()["leads"]


async def test_stats_for_demo_board(client):
    await _board(client)
    stats = (await client.get("/api/stats")).json()
    assert stats["total"] == 25
    # Демо-заявки разложены по последним шести дням — все попадают в неделю
    assert stats["week_total"] == 25 and len(stats["by_day"]) == 7
    assert sum(day["total"] for day in stats["by_day"]) == 25
    assert stats["week_spam"] == 5 and abs(stats["spam_share"] - 5 / 25) < 1e-9
    by_type = {item["key"]: item["count"] for item in stats["by_type"]}
    assert by_type == {"new_site": 7, "improvement": 4, "support": 5, "question": 4, "spam": 5}
    assert {item["key"] for item in stats["by_channel"]} == {"form", "telegram", "manual"}
    assert stats["avg_triage_ms"] and stats["avg_triage_ms"] > 300
    assert stats["urgent_open"] >= 1 and stats["edited_share"] == 0


async def test_stats_follow_board_changes(client):
    leads = await _board(client)
    lead = next(item for item in leads if item["demo_id"] == "L01")
    await client.patch(f"/api/leads/{lead['id']}/triage", json={"budget": "до 250 тыс. ₽"})
    stats = (await client.get("/api/stats")).json()
    assert abs(stats["edited_share"] - 1 / 25) < 1e-9


async def test_csv_export_opens_in_excel(client):
    await _board(client)
    resp = await client.get("/api/export/leads.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert 'filename="leadsort-' in resp.headers["content-disposition"]
    text = resp.content.decode("utf-8")
    assert text.startswith("\ufeff")
    rows = list(csv.reader(io.StringIO(text.lstrip("\ufeff")), delimiter=";"))
    assert rows[0][:5] == ["Дата", "Канал", "Колонка", "Тип", "Срочность"]
    assert len(rows) == 26
    alina = next(row for row in rows if row[6] == "Алина")
    assert alina[1] == "форма на сайте" and alina[3] == "Новый сайт"
    assert alina[7] == "+7 (843) 211-45-90"


async def test_send_to_crm_is_logged(client):
    leads = await _board(client)
    lead = next(item for item in leads if item["demo_id"] == "L03")
    resp = await client.post(f"/api/leads/{lead['id']}/crm", json={"crm": "bitrix24"})
    assert resp.status_code == 200
    detail = resp.json()
    sent = detail["crm_requests"][-1]
    fields = sent["request"]["body"]["fields"]
    assert sent["crm"] == "bitrix24" and fields["NAME"] == "Марина"
    assert fields["PHONE"] == [{"VALUE": "+7 (903) 123-45-67", "VALUE_TYPE": "WORK"}]
    assert fields["IM"][0]["VALUE"] == "@marina_decor"
    assert sent["response"]["status"] == 200
    assert "Битрикс24" in detail["events"][-1]["text"]

    amo = (await client.post(f"/api/leads/{lead['id']}/crm", json={"crm": "amocrm"})).json()
    body = amo["crm_requests"][-1]["request"]["body"][0]
    assert body["name"].startswith("Доработка") and len(amo["crm_requests"]) == 2
    # Токены в журнале не показываются
    assert "•" in amo["crm_requests"][-1]["request"]["headers"]["Authorization"]


async def test_unknown_crm_is_rejected(client):
    lead = (await _board(client))[0]
    resp = await client.post(f"/api/leads/{lead['id']}/crm", json={"crm": "salesforce"})
    assert resp.status_code == 422


async def test_reset_clears_crm_log(client):
    lead = (await _board(client))[0]
    await client.post(f"/api/leads/{lead['id']}/crm", json={"crm": "amocrm"})
    await client.post("/api/demo/reset")
    fresh = (await _board(client))[0]
    assert (await client.get(f"/api/leads/{fresh['id']}")).json()["crm_requests"] == []


def test_budget_parsing():
    assert parse_budget("до 100 тыс. ₽") == 100_000
    assert parse_budget("150–200 тыс. ₽") == 150_000
    assert parse_budget("30к рублей") == 30_000
    assert parse_budget("около $1500") == 1500
    assert parse_budget("1,5 млн") == 1_500_000
    assert parse_budget("не указано") is None


def test_stats_week_window():
    from app.models import Lead
    from app.services.stats import board_stats

    now = datetime(2026, 10, 26, 12, tzinfo=UTC)
    old = Lead(id="a", channel="form", status="new", text="x", created_at=now - timedelta(days=9))
    fresh = Lead(id="b", channel="manual", status="new", text="y", created_at=now)
    stats = board_stats([old, fresh], now)
    assert stats.total == 2 and stats.week_total == 1
    assert stats.by_day[-1].date == "2026-10-26" and stats.by_day[-1].total == 1
