from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    redis_url: str = Field(
        default="redis://localhost:6379/0", validation_alias=AliasChoices("REDIS_URL", "KV_URL")
    )
    cors_origins: str = "http://localhost:3000"
    # Превью-деплои Vercel получают случайные адреса — их удобнее разрешить регуляркой
    cors_origin_regex: str | None = None
    # За прокси (Vercel, Render, nginx) реальный IP приходит в X-Forwarded-For
    trust_proxy: bool = True

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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
