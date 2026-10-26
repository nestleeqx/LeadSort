"""Передача заявки в amoCRM и Битрикс24.

В демо запрос никуда не уходит: сервис собирает его в том виде, в каком отправил бы
в настоящую CRM, и сохраняет вместе с типичным ответом — менеджер видит, что именно
передаётся. Для боевого подключения достаточно отправить этот запрос httpx с токеном клиента.
"""

import random
import re
from typing import Any

from app.models import Lead
from app.services.export import TYPES, URGENCY

CRM_NAMES = {"amocrm": "amoCRM", "bitrix24": "Битрикс24"}
HIDDEN = "•••••••••"


def parse_budget(text: str) -> int | None:
    """«до 100 тыс. ₽» → 100000, «150–200 тыс.» → 150000, «около $1500» → 1500."""
    m = re.search(r"(\d[\d\s]*(?:[.,]\d+)?)\s*(млн|тыс|т\.?\s?р|к\b|k\b)?", text, re.I)
    if not m:
        return None
    number = float(m.group(1).replace(" ", "").replace(",", "."))
    unit = (m.group(2) or "").lower()
    if unit.startswith("млн"):
        number *= 1_000_000
    elif unit:
        number *= 1_000
    # Диапазон «150–200 тыс.»: множитель стоит после второго числа
    elif re.match(r"\s*[–—-]\s*\d[\d\s]*\s*(тыс|млн)", text[m.end() :], re.I):
        number *= 1_000_000 if "млн" in text[m.end() :].lower() else 1_000
    return round(number)


def _title(lead: Lead) -> str:
    t = lead.triage or {}
    name = t.get("contacts", {}).get("name") or "Без имени"
    return f"{TYPES.get(t.get('type', ''), 'Заявка')}: {name}"


def _comment(lead: Lead) -> str:
    t = lead.triage or {}
    parts = [t.get("summary", "")]
    if t.get("missing"):
        parts.append("Уточнить: " + "; ".join(t["missing"]))
    parts.append(f"Исходный текст:\n{lead.text}")
    return "\n\n".join(part for part in parts if part)


def _amocrm(lead: Lead) -> dict[str, Any]:
    t = lead.triage or {}
    c = t.get("contacts", {})
    fields = []
    if c.get("phones"):
        fields.append(
            {
                "field_code": "PHONE",
                "values": [{"value": p, "enum_code": "WORK"} for p in c["phones"]],
            }
        )
    if c.get("emails"):
        fields.append(
            {
                "field_code": "EMAIL",
                "values": [{"value": e, "enum_code": "WORK"} for e in c["emails"]],
            }
        )
    lead_body: dict[str, Any] = {
        "name": _title(lead),
        "_embedded": {
            "contacts": [
                {"first_name": c.get("name") or "Без имени", "custom_fields_values": fields}
            ],
            "tags": [
                {"name": TYPES.get(t.get("type", ""), "")},
                {"name": f"Срочность: {URGENCY.get(t.get('urgency', ''), '')}"},
                {"name": "LeadSort"},
            ],
        },
    }
    price = parse_budget(t.get("budget", ""))
    if price:
        lead_body["price"] = price
    return {
        "method": "POST",
        "url": "https://<аккаунт>.amocrm.ru/api/v4/leads/complex",
        "headers": {"Authorization": f"Bearer {HIDDEN}", "Content-Type": "application/json"},
        "body": [lead_body],
    }


def _bitrix24(lead: Lead) -> dict[str, Any]:
    t = lead.triage or {}
    c = t.get("contacts", {})
    fields: dict[str, Any] = {
        "TITLE": _title(lead),
        "NAME": c.get("name", ""),
        "SOURCE_ID": "WEB" if lead.channel == "form" else "OTHER",
        "COMMENTS": _comment(lead),
    }
    if c.get("phones"):
        fields["PHONE"] = [{"VALUE": p, "VALUE_TYPE": "WORK"} for p in c["phones"]]
    if c.get("emails"):
        fields["EMAIL"] = [{"VALUE": e, "VALUE_TYPE": "WORK"} for e in c["emails"]]
    if c.get("telegram"):
        fields["IM"] = [{"VALUE": tg, "VALUE_TYPE": "TELEGRAM"} for tg in c["telegram"]]
    price = parse_budget(t.get("budget", ""))
    if price:
        fields["OPPORTUNITY"] = price
        fields["CURRENCY_ID"] = "RUB"
    return {
        "method": "POST",
        "url": f"https://<портал>.bitrix24.ru/rest/1/{HIDDEN}/crm.lead.add.json",
        "headers": {"Content-Type": "application/json"},
        "body": {"fields": fields, "params": {"REGISTER_SONET_EVENT": "Y"}},
    }


def build_request(crm: str, lead: Lead) -> dict[str, Any]:
    return _amocrm(lead) if crm == "amocrm" else _bitrix24(lead)


def demo_response(crm: str) -> dict[str, Any]:
    """Так отвечает CRM на успешное создание сделки — номера случайные."""
    if crm == "amocrm":
        return {
            "status": 200,
            "body": [
                {
                    "id": random.randint(10_000_000, 99_999_999),
                    "contact_id": random.randint(10_000_000, 99_999_999),
                }
            ],
        }
    return {"status": 200, "body": {"result": random.randint(1_000, 99_999)}}
