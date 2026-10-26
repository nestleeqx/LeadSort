"""Разбор заявки по ключевым словам без внешнего API.

Нужен, чтобы проект запускался без ключей. Точность ниже, чем у нейросети,
но поля заполняются из текста, а не выдумываются.
"""

import asyncio
import json
import re

from pydantic import BaseModel

from app.llm.base import LLMProvider
from app.services.contacts import find_contacts

_SPAM = re.compile(
    r"продвижени|раскрутк|seo|базы? клиент|казино|крипт|заработ|кредит|рассылк|"
    r"увеличим продажи|выведем в топ|предлагаем (?:вам )?(?:услуг|сотруднич)|https?://\S+.*https?://",
    re.I | re.S,
)
_SUPPORT = re.compile(
    r"не работает|не открывается|упал|слома|ошибк|не приходят|не принимает|взлом|вирус|"
    r"пропал|глючит|поддержк|обслуживан|хостинг|продлить",
    re.I,
)
_IMPROVEMENT = re.compile(
    r"доработ|добавить|изменить|поменять|переделать|подключить|интеграц|ускорить|"
    r"новый раздел|на (?:нашем|моём|моем) сайте|на сайте нужно",
    re.I,
)
_NEW_SITE = re.compile(
    r"(?:сделать|создать|разработ|нуж(?:ен|на|но)|хоч\w*|хотим|хотел\w*|заказать)\W+(?:\w+\W+){0,3}?"
    r"(?:сайт|лендинг|интернет-магазин|магазин|портал|страниц)",
    re.I,
)
_URGENT = re.compile(
    r"срочно|сегодня|завтра|горит|asap|как можно скорее|не работает|упал|взлом", re.I
)
_BUDGET = re.compile(
    r"(?:(?:до|от|около|примерно|в районе)\s+)?\d[\d\s]*(?:[.,]\d+)?\s?"
    r"(?:тыс\.?|тысяч\w*|т\.р\.?|к|k|млн|000)\s?(?:руб\w*|₽|р\.)?",
    re.I,
)
_DEADLINE = re.compile(
    r"(?:к|до)\s+(?:концу\s+)?(?:\d{1,2}\s+)?(?:января|февраля|марта|апреля|мая|июня|июля|"
    r"августа|сентября|октября|ноября|декабря|понедельник\w*|пятниц\w*|недел\w*|месяц\w*|"
    r"нового года|лету|осени|весне)|за\s+(?:\d+\s+)?(?:недел\w*|дн\w*|месяц\w*)|"
    r"сегодня|завтра|срочно",
    re.I,
)
# Имя: «меня зовут Анна», подпись отдельной строкой («Анна, менеджер») или слово в конце текста
_NAME_PATTERNS = [
    re.compile(r"меня зовут\s+([А-ЯЁ][а-яё]{2,15})"),
    re.compile(
        r"^\s*(?:с уважением,?\s*)?([А-ЯЁ][а-яё]{2,15})(?:\s+[А-ЯЁ][а-яё]+)?\s*(?:,.*)?$",
        re.M | re.I,
    ),
    re.compile(r"\s([А-ЯЁ][а-яё]{2,15})[.!]?\s*$"),
]
_NOT_NAMES = {"Здравствуйте", "Добрый", "Доброе", "Привет", "Спасибо"}
_GREETING = re.compile(r"^(?:здравствуйте|добр\w+ (?:день|утро|вечер)|привет|hi|hello)\W*$", re.I)

_TITLES = {
    "new_site": "Клиент хочет новый сайт",
    "improvement": "Клиент просит доработать существующий сайт",
    "support": "На сайте клиента что-то сломалось или нужна поддержка",
    "question": "Клиент задаёт вопрос об услугах студии",
}


_REPLIES = {
    "new_site": "Будем рады сделать для вас новый сайт.",
    "improvement": "Посмотрим, как лучше доработать ваш сайт.",
    "support": "Понимаем, что на сайте возникла проблема, — займёмся ей в первую очередь.",
    "question": "С радостью ответим на ваш вопрос.",
}


def _lead_text(user: str) -> str:
    m = re.search(r"<<<\n(.*)\n>>>", user, re.S)
    return m.group(1) if m else user


def mock_triage(text: str) -> dict:
    found = find_contacts(text)
    if _SPAM.search(text):
        kind = "spam"
    elif _SUPPORT.search(text):
        kind = "support"
    elif _IMPROVEMENT.search(text):
        kind = "improvement"
    elif _NEW_SITE.search(text):
        kind = "new_site"
    else:
        kind = "question"

    budget = _BUDGET.search(text)
    deadline = _DEADLINE.search(text)
    if kind == "spam":
        urgency, reason = "low", "Рекламная рассылка"
    elif _URGENT.search(text):
        urgency, reason = "high", "В тексте есть признаки срочности"
    elif budget or deadline:
        urgency, reason = "medium", "Есть конкретные сроки или бюджет"
    else:
        urgency, reason = "low", "Нет срока и бюджета"

    name = ""
    for pattern in _NAME_PATTERNS:
        m = pattern.search(text)
        if m and m.group(1)[0].isupper() and m.group(1) not in _NOT_NAMES:
            name = m.group(1)
            break

    sentences = re.split(r"(?<=[.!?])\s", " ".join(text.split()))
    # Приветствие в резюме не нужно — берём первое содержательное предложение
    first = next((s for s in sentences if not _GREETING.match(s)), sentences[0])
    summary = f"{_TITLES.get(kind, 'Рекламное сообщение')}: «{first[:140]}»"

    missing = []
    if kind != "spam":
        if not budget and kind in {"new_site", "improvement"}:
            missing.append("Какой бюджет вы рассматриваете?")
        if not deadline and kind != "question":
            missing.append("К какому сроку нужен результат?")
        if kind in {"improvement", "support"} and not re.search(
            r"https?://|\w+\.(?:ru|рф|com)", text
        ):
            missing.append("Пришлите, пожалуйста, адрес сайта.")
        if not (found.phones or found.emails or found.telegram):
            missing.append("Как с вами удобнее связаться?")

    reply = ""
    if kind != "spam":
        hello = f"Здравствуйте, {name}!" if name else "Здравствуйте!"
        questions = " ".join(missing) if missing else "Подготовим предложение и вернёмся с ответом."
        reply = (
            f"{hello} Спасибо за обращение в «Пиксель». {_REPLIES[kind]} {questions}"
            "\n\nМенеджер студии «Пиксель»"
        )

    return {
        "type": kind,
        "urgency": urgency,
        "urgency_reason": reason,
        "contacts": {
            "name": name,
            "phones": [f.value for f in found.phones],
            "emails": [f.value for f in found.emails],
            "telegram": [f.value for f in found.telegram],
        },
        "budget": budget.group().strip() if budget else "не указано",
        "deadline": deadline.group().strip() if deadline else "не указано",
        "summary": summary,
        "missing": missing,
        "reply_draft": reply,
    }


class MockProvider(LLMProvider):
    name = "mock"
    model = "keywords"

    def __init__(self, delay: float = 0.8):
        self.delay = delay

    async def _complete(self, system: str, user: str, schema: type[BaseModel]) -> str:
        if self.delay:
            await asyncio.sleep(self.delay)
        return json.dumps(mock_triage(_lead_text(user)), ensure_ascii=False)
