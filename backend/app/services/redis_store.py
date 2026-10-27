import hashlib
import time

from pydantic import BaseModel
from redis.asyncio import Redis

from app.config import get_settings
from app.llm import LLMProvider

_redis: Redis | None = None

# Общий префикс ключей: Redis можно делить с другими проектами (в демо — с CardForge),
# и ни лимиты, ни кеш не пересекутся
PREFIX = "leadsort:"


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    return _redis


def set_redis(client: Redis) -> None:
    global _redis
    _redis = client


# --- Кеш одинаковых запросов к модели ---


async def cached_complete[T: BaseModel](
    redis: Redis,
    provider: LLMProvider,
    system: str,
    user: str,
    schema: type[T],
    fresh: bool = False,
) -> T:
    """fresh — спросить модель заново, даже если ответ есть в кеше; новый ответ заменит старый."""
    digest = hashlib.sha256(
        "\x00".join([provider.name, provider.model, schema.__name__, system, user]).encode()
    ).hexdigest()
    key = f"{PREFIX}llm:{digest}"
    hit = None if fresh else await redis.get(key)
    if hit:
        return schema.model_validate_json(hit)
    result = await provider.complete_json(system, user, schema)
    await redis.set(key, result.model_dump_json(), ex=get_settings().cache_ttl_seconds)
    return result


# --- Лимит запросов по IP: фиксированное окно в час ---


class RateLimitExceeded(Exception):
    def __init__(self, scope: str, limit: int, retry_after: int):
        super().__init__(scope)
        self.scope, self.limit, self.retry_after = scope, limit, retry_after


def _window() -> tuple[int, int]:
    now = int(time.time())
    return now // 3600, 3600 - now % 3600


async def hit_limit(redis: Redis, scope: str, ip: str, limit: int, cost: int = 1) -> None:
    bucket, retry_after = _window()
    key = f"{PREFIX}rl:{scope}:{ip}:{bucket}"
    used = await redis.incrby(key, cost)
    if used == cost:
        await redis.expire(key, 3600)
    if used > limit:
        await redis.decrby(key, cost)
        raise RateLimitExceeded(scope, limit, retry_after)


async def remaining(redis: Redis, scope: str, ip: str, limit: int) -> int:
    bucket, _ = _window()
    used = int(await redis.get(f"{PREFIX}rl:{scope}:{ip}:{bucket}") or 0)
    return max(0, limit - used)
