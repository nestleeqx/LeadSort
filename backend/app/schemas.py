from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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


# --- Доска ---

Channel = Literal["form", "telegram", "manual"]
Column = Literal["new", "in_progress", "waiting", "closed", "spam"]
LeadState = Literal["queued", "running", "done", "error"]


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel: Channel
    status: Column
    position: float
    text: str
    state: LeadState
    error: str | None
    triage: Triage | None
    highlights: list[Highlight]
    notes: list[str]
    method: Literal["ai", "rules"] | None
    elapsed_ms: int | None
    edited: list[str]
    demo_id: str | None
    created_at: datetime


class LeadEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    at: datetime
    text: str


class LeadDetail(LeadOut):
    events: list[LeadEventOut]


class BoardOut(BaseModel):
    leads: list[LeadOut]


class LeadCreate(BaseModel):
    text: str


class FormSubmit(BaseModel):
    """Заявка с формы на сайте студии: поля как на настоящем сайте."""

    name: str = Field(default="", max_length=80)
    contact: str = Field(default="", max_length=120)
    message: str = Field(default="", max_length=3000)


class LeadMove(BaseModel):
    status: Column
    # Без позиции карточка встаёт наверх колонки (смена колонки из карточки заявки)
    position: float | None = None


class TriageEdit(BaseModel):
    """Ручная правка разбора: приходят только изменённые поля."""

    type: LeadType | None = None
    urgency: Urgency | None = None
    urgency_reason: str | None = Field(default=None, max_length=300)
    contacts: Contacts | None = None
    budget: str | None = Field(default=None, max_length=200)
    deadline: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=1000)
    missing: list[str] | None = Field(default=None, max_length=10)
    reply_draft: str | None = Field(default=None, max_length=4000)
