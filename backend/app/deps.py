from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis

from app.config import get_settings
from app.llm import LLMProvider
from app.services.redis_store import get_redis


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_provider(request: Request) -> LLMProvider:
    return request.app.state.provider


RedisDep = Annotated[Redis, Depends(get_redis)]
IpDep = Annotated[str, Depends(client_ip)]
ProviderDep = Annotated[LLMProvider, Depends(get_provider)]
