from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.deps import IpDep, ProviderDep, RedisDep, SessionDep
from app.schemas import LimitsOut
from app.services.demo import cleanup_old
from app.services.redis_store import remaining

router = APIRouter(prefix="/api", tags=["misc"])


@router.get("/health")
async def health():
    return {"ok": True}


@router.get("/limits", response_model=LimitsOut)
async def limits(redis: RedisDep, provider: ProviderDep, ip: IpDep):
    s = get_settings()
    return LimitsOut(
        max_lead_chars=s.max_lead_chars,
        triages_per_hour=s.triages_per_hour,
        triages_left=await remaining(redis, "triage", ip, s.triages_per_hour),
        provider=f"{provider.name}:{provider.model}",
    )


@router.get("/cron/cleanup")
async def cron_cleanup(session: SessionDep, authorization: str | None = Header(default=None)):
    """Ночная очистка досок, которые никто не открывал сутки (Vercel Cron)."""
    secret = get_settings().cron_secret
    if not secret or authorization != f"Bearer {secret}":
        raise HTTPException(401, "Нужен CRON_SECRET")
    removed = await cleanup_old(session, get_settings().board_ttl_hours)
    return {"removed": removed}
