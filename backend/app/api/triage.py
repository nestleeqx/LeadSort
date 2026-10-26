import logging
import time

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.deps import IpDep, ProviderDep, RedisDep
from app.llm import LLMError
from app.schemas import TriageIn, TriageOut
from app.services.redis_store import hit_limit
from app.services.triage import triage_lead

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["triage"])


@router.post("/triage", response_model=TriageOut)
async def triage(body: TriageIn, redis: RedisDep, provider: ProviderDep, ip: IpDep):
    """Разобрать текст заявки без сохранения — песочница /try."""
    s = get_settings()
    text = body.text.strip()
    if len(text) > s.max_lead_chars:
        raise HTTPException(
            422, f"Текст заявки длиннее {s.max_lead_chars} символов — сократите его."
        )
    await hit_limit(redis, "triage", ip, s.triages_per_hour)
    started = time.perf_counter()
    try:
        result = await triage_lead(provider, redis, text)
    except LLMError:
        log.exception("Не удалось разобрать заявку")
        raise HTTPException(
            502, "Нейросеть сейчас не ответила. Попробуйте ещё раз через минуту."
        ) from None
    return TriageOut(
        triage=result.triage,
        highlights=result.highlights,
        notes=result.notes,
        method=result.method,
        elapsed_ms=round((time.perf_counter() - started) * 1000),
    )
