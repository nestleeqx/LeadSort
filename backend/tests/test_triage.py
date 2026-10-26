import json

from app.llm.base import LLMProvider
from app.services.triage import triage_lead


class Scripted(LLMProvider):
    """Провайдер, который отвечает заготовленным JSON и считает вызовы."""

    name, model = "scripted", "test"

    def __init__(self, **overrides):
        self.calls = 0
        self.reply = {
            "type": "new_site",
            "urgency": "medium",
            "urgency_reason": "Есть срок",
            "contacts": {"name": "", "phones": [], "emails": [], "telegram": []},
            "budget": "до 100 тыс. ₽",
            "deadline": "к концу месяца",
            "summary": "Нужен лендинг для кофейни.",
            "missing": ["Есть ли логотип?"],
            "reply_draft": "Здравствуйте!",
        } | overrides

    async def _complete(self, system, user, schema):
        self.calls += 1
        return json.dumps(self.reply, ensure_ascii=False)


LEAD = "Нужен лендинг для кофейни к концу месяца, бюджет до 100 тысяч. Звоните 8 916 123 45 67"


async def test_empty_message_is_spam_without_model(redis):
    provider = Scripted()
    result = await triage_lead(provider, redis, "   ...  ")
    assert result.triage.type == "spam" and not result.triage.notify
    assert result.method == "rules" and provider.calls == 0


async def test_only_phone_is_a_lead_without_model(redis):
    provider = Scripted()
    result = await triage_lead(provider, redis, "перезвоните 89161234567")
    assert result.triage.type == "question" and result.method == "rules"
    assert result.triage.contacts.phones == ["+7 (916) 123-45-67"]
    assert provider.calls == 0


async def test_regex_finds_contacts_the_model_missed(redis):
    result = await triage_lead(Scripted(), redis, LEAD)
    assert result.triage.contacts.phones == ["+7 (916) 123-45-67"]
    assert [h.kind for h in result.highlights] == ["phone"]


async def test_made_up_contacts_are_dropped(redis):
    provider = Scripted(
        contacts={
            "name": "Мария",
            "phones": ["+7 999 111-22-33", "89161234567"],
            "emails": ["coffee@mail.ru"],
            "telegram": [],
        }
    )
    result = await triage_lead(provider, redis, LEAD)
    contacts = result.triage.contacts
    assert contacts.phones == ["+7 (916) 123-45-67"]
    assert contacts.emails == [] and contacts.name == ""
    assert len(result.notes) == 3


async def test_spam_never_notifies(redis):
    provider = Scripted(type="spam", urgency="high", reply_draft="Спасибо!", missing=["?"])
    result = await triage_lead(provider, redis, "Выведем ваш сайт в ТОП Яндекса за 3 дня!")
    t = result.triage
    assert t.urgency == "low" and not t.notify and t.reply_draft == "" and t.missing == []


async def test_urgent_lead_notifies(redis):
    provider = Scripted(type="support", urgency="high")
    result = await triage_lead(provider, redis, "Сайт не открывается с утра, теряем заказы!")
    assert result.triage.notify


async def test_same_text_is_taken_from_cache(redis):
    provider = Scripted()
    await triage_lead(provider, redis, LEAD)
    await triage_lead(provider, redis, LEAD)
    assert provider.calls == 1


async def test_broken_json_is_retried_once(redis):
    class Flaky(Scripted):
        async def _complete(self, system, user, schema):
            self.calls += 1
            if self.calls == 1:
                return "не JSON"
            return json.dumps(self.reply, ensure_ascii=False)

    provider = Flaky()
    result = await triage_lead(provider, redis, LEAD)
    assert result.triage.type == "new_site" and provider.calls == 2


async def test_signature_goes_to_its_own_paragraph(redis):
    provider = Scripted(reply_draft="Здравствуйте! Подскажите сроки. Менеджер студии «Пиксель»")
    result = await triage_lead(provider, redis, LEAD)
    assert result.triage.reply_draft.endswith("сроки.\n\nМенеджер студии «Пиксель»")


async def test_spam_has_no_budget_or_deadline(redis):
    provider = Scripted(type="spam", deadline="за 14 дней")
    result = await triage_lead(provider, redis, "Выведем в ТОП за 14 дней!")
    assert result.triage.deadline == "не указано" and result.triage.budget == "не указано"
