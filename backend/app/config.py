import hashlib
from functools import lru_cache
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Приводит строку подключения Neon/Heroku-вида к драйверу asyncpg.

    postgres://…?sslmode=require&channel_binding=require → postgresql+asyncpg://…?ssl=require
    """
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"
    if not scheme.startswith("postgresql"):
        return url
    query = []
    for key, value in parse_qsl(parts.query):
        if key == "sslmode":
            query.append(("ssl", value))
        elif key != "channel_binding":
            query.append((key, value))
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    # Интеграции Vercel (Neon, Upstash) называют переменные по-своему.
    # Прямое подключение без пулера предпочтительнее: asyncpg и pgbouncer плохо дружат.
    database_url: str = Field(
        default="postgresql+asyncpg://leadsort:leadsort@localhost:5432/leadsort",
        validation_alias=AliasChoices(
            "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL", "POSTGRES_URL"
        ),
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0", validation_alias=AliasChoices("REDIS_URL", "KV_URL")
    )
    cors_origins: str = "http://localhost:3000"
    # Превью-деплои Vercel получают случайные адреса — их удобнее разрешить регуляркой
    cors_origin_regex: str | None = None
    # За прокси (Vercel, Render, nginx) реальный IP приходит в X-Forwarded-For
    trust_proxy: bool = True
    # Vercel выставляет VERCEL=1 во всех своих окружениях
    vercel: bool = False
    # Секрет, который Vercel Cron передаёт в Authorization: Bearer …
    cron_secret: str = ""

    # Нейросеть: openai — любой OpenAI-совместимый API (OpenAI, OpenRouter, DeepSeek, vLLM),
    # yandex — YandexGPT, mock — разбор по ключевым словам без внешнего API
    llm_provider: Literal["openai", "yandex", "mock"] = "mock"
    llm_timeout: float = 60.0
    llm_temperature: float = 0.2
    # Пауза шаблонного разбора, чтобы в демо было видно ожидание
    mock_delay: float = 0.8

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    # json_schema — строгая схема (OpenAI, OpenRouter); json_object — для API без поддержки схем
    openai_json_mode: Literal["json_schema", "json_object"] = "json_schema"
    # Глубина рассуждений для моделей GPT-5 и o-серии (none, minimal, low, medium, high).
    # Пусто — не передаём: старые модели этот параметр не знают
    openai_reasoning_effort: str = ""

    yandex_api_key: str = ""
    yandex_folder_id: str = ""
    yandex_model: str = "yandexgpt/latest"

    # Защита бюджета
    max_lead_chars: int = 4000
    triages_per_hour: int = 30
    cache_ttl_seconds: int = 7 * 24 * 3600
    demo_resets_per_hour: int = 10
    # Доска посетителя удаляется, если он не заходил сутки; при следующем визите демо — заново
    board_ttl_hours: int = 24

    # inline — разбор фоновой задачей в процессе API (Docker, VPS, тесты);
    # poll — без фоновых процессов: заявки разбираются, пока доска опрашивает API
    # (serverless, например Vercel). По умолчанию на Vercel — poll, иначе inline.
    queue_mode: Literal["inline", "poll"] | None = None
    worker_concurrency: int = 5

    # Telegram-бот: токен от @BotFather. Пусто — бот выключен, доска работает без него.
    # Локально бот опрашивает Telegram сам (сервис bot в Docker), на Vercel — вебхук,
    # который ставится при первом обращении к /api/telegram
    telegram_bot_token: str = ""
    # Адрес сайта для ссылок в сообщениях бота. Пусто — первый адрес из CORS_ORIGINS
    site_url: str = ""
    # Vercel передаёт постоянный адрес проекта — по нему ставится вебхук
    vercel_project_production_url: str = ""

    @field_validator("database_url")
    @classmethod
    def _normalize_db(cls, v: str) -> str:
        return normalize_database_url(v)

    @model_validator(mode="after")
    def _default_queue(self) -> "Settings":
        if self.queue_mode is None:
            self.queue_mode = "poll" if self.vercel else "inline"
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def public_site_url(self) -> str:
        url = self.site_url or next(iter(self.cors_origin_list), "http://localhost:3000")
        return url.rstrip("/")

    @property
    def telegram_webhook_secret(self) -> str:
        """Секрет вебхука выводится из токена: ещё одна переменная окружения не нужна."""
        if not self.telegram_bot_token:
            return ""
        return hashlib.sha256(f"leadsort-webhook:{self.telegram_bot_token}".encode()).hexdigest()


@lru_cache
def get_settings() -> Settings:
    return Settings()
