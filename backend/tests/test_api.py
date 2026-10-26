async def test_triage_with_mock_provider(client):
    resp = await client.post(
        "/api/triage",
        json={"text": "Здравствуйте! Сайт не открывается с утра, срочно. Анна, anna [at] mail.ru"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["triage"]["type"] == "support"
    assert body["triage"]["urgency"] == "high" and body["triage"]["notify"]
    assert body["triage"]["contacts"]["emails"] == ["anna@mail.ru"]
    assert body["method"] == "ai"


async def test_too_long_text_is_rejected(client):
    resp = await client.post("/api/triage", json={"text": "а" * 4001})
    assert resp.status_code == 422 and "4000" in resp.json()["detail"]


async def test_rate_limit_per_ip(client):
    for _ in range(30):
        assert (await client.post("/api/triage", json={"text": "..."})).status_code == 200
    resp = await client.post("/api/triage", json={"text": "..."})
    assert resp.status_code == 429 and "30 разборов в час" in resp.json()["detail"]
    limits = (await client.get("/api/limits")).json()
    assert limits["triages_left"] == 0


async def test_redis_keys_are_prefixed(client, redis):
    """Redis общий с CardForge: все ключи LeadSort начинаются с leadsort:."""
    await client.post("/api/triage", json={"text": "Нужен лендинг для кофейни к весне"})
    keys = await redis.keys("*")
    assert keys and all(key.startswith("leadsort:") for key in keys)
