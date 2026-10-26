from typing import Literal

from pydantic import BaseModel, Field

LeadType = Literal["new_site", "improvement", "support", "question", "spam"]
Urgency = Literal["high", "medium", "low"]


# --- Что возвращает нейросеть (JSON по схеме) ---


class AiContacts(BaseModel):
    name: str = Field(description="Имя клиента, как он сам подписался; пустая строка, если нет")
    phones: list[str] = Field(description="Телефоны в том виде, как написаны в тексте")
    emails: list[str] = Field(description="Адреса почты")
    telegram: list[str] = Field(description="Ники в Telegram в виде @username")


class AiTriage(BaseModel):
    type: LeadType
    urgency: Urgency
    urgency_reason: str = Field(description="Почему такая срочность, одна короткая фраза")
    contacts: AiContacts
    budget: str = Field(
        description="Бюджет своими словами, например «до 100 тыс. ₽», или «не указано»"
    )
    deadline: str = Field(description="Сроки, например «к концу месяца», или «не указано»")
    summary: str = Field(description="1–2 предложения: что хочет клиент")
    missing: list[str] = Field(description="Вопросы, которые нужно задать клиенту, 0–4 штуки")
    reply_draft: str = Field(description="Черновик ответа клиенту; для спама — пустая строка")


# --- Что отдаёт API ---


class Contacts(BaseModel):
    name: str = ""
    phones: list[str] = []
    emails: list[str] = []
    telegram: list[str] = []


class Triage(BaseModel):
    type: LeadType
    urgency: Urgency
    urgency_reason: str
    contacts: Contacts
    budget: str
    deadline: str
    summary: str
    missing: list[str]
    reply_draft: str
    # Уведомлять менеджера в Telegram: высокая срочность и не спам
    notify: bool


class Highlight(BaseModel):
    """Фрагмент исходного текста, из которого извлечён контакт."""

    start: int
    end: int
    kind: Literal["phone", "email", "telegram", "name"]


class TriageIn(BaseModel):
    text: str


class TriageOut(BaseModel):
    triage: Triage
    highlights: list[Highlight]
    # Что сервис поправил за нейросетью — показывается под результатом
    notes: list[str]
    # ai — разобрала нейросеть; rules — хватило правил (например, пустое сообщение)
    method: Literal["ai", "rules"]
    elapsed_ms: int


class LimitsOut(BaseModel):
    max_lead_chars: int
    triages_per_hour: int
    triages_left: int
    provider: str
