import os

os.environ.update(LLM_PROVIDER="mock", MOCK_DELAY="0", TRIAGES_PER_HOUR="30")

import fakeredis  # noqa: E402
import httpx  # noqa: E402
import pytest  # noqa: E402

from app.main import app  # noqa: E402
from app.services.redis_store import set_redis  # noqa: E402


@pytest.fixture
def redis():
    client = fakeredis.FakeAsyncRedis(decode_responses=True)
    set_redis(client)
    return client


@pytest.fixture
async def client(redis):
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
