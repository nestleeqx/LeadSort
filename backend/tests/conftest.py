import os
import tempfile
from pathlib import Path

_db = Path(tempfile.mkdtemp()) / "test.db"
os.environ.update(
    DATABASE_URL=f"sqlite+aiosqlite:///{_db.as_posix()}",
    QUEUE_MODE="inline",
    LLM_PROVIDER="mock",
    MOCK_DELAY="0",
    TRIAGES_PER_HOUR="30",
    # Токен из .env разработчика не должен попасть в тесты: они не ходят в настоящий Telegram
    TELEGRAM_BOT_TOKEN="",
)

import fakeredis  # noqa: E402
import httpx  # noqa: E402
import pytest  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.redis_store import set_redis  # noqa: E402

VISITOR = "test-visitor-0001"


@pytest.fixture
def redis():
    client = fakeredis.FakeAsyncRedis(decode_responses=True)
    set_redis(client)
    return client


@pytest.fixture
async def client(redis):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://test", headers={"X-Visitor-Id": VISITOR}
        ) as c:
            yield c
    await engine.dispose()


async def drain():
    """Дождаться фонового разбора заявок."""
    await app.state.queue.drain()
