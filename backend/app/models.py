import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid() -> str:
    return uuid.uuid4().hex


class Visitor(Base):
    """Анонимный посетитель: у каждого своя доска с копией демо-заявок.

    Запись появляется при первом визите вместе с демо. Доски тех, кто не заходил
    больше суток, удаляет ночная очистка — при следующем визите демо создаётся заново.
    """

    __tablename__ = "visitors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    visitor_id: Mapped[str] = mapped_column(
        ForeignKey("visitors.id", ondelete="CASCADE"), index=True
    )
    # form | telegram | manual
    channel: Mapped[str] = mapped_column(String(16))
    # Колонка доски: new | in_progress | waiting | closed | spam
    status: Mapped[str] = mapped_column(String(16), default="new")
    # Порядок внутри колонки: меньше — выше
    position: Mapped[float] = mapped_column(Float, default=0)
    text: Mapped[str] = mapped_column(Text)

    # Разбор: queued | running | done | error
    state: Mapped[str] = mapped_column(String(16), default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    triage: Mapped[dict[str, Any] | None] = mapped_column(JSONType, nullable=True)
    highlights: Mapped[list[dict[str, Any]]] = mapped_column(JSONType, default=list)
    notes: Mapped[list[str]] = mapped_column(JSONType, default=list)
    # ai | rules
    method: Mapped[str | None] = mapped_column(String(8), nullable=True)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Поля разбора, которые менеджер поправил руками
    edited: Mapped[list[str]] = mapped_column(JSONType, default=list)
    # Номер заявки в демо-наборе (L01…L25), у новых заявок пусто
    demo_id: Mapped[str | None] = mapped_column(String(8), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    events: Mapped[list["LeadEvent"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="LeadEvent.id"
    )


class LeadEvent(Base):
    """История заявки: получена, разобрана, перенесена, поправлена — уже готовым текстом."""

    __tablename__ = "lead_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    text: Mapped[str] = mapped_column(Text)

    lead: Mapped[Lead] = relationship(back_populates="events")
