"""Поиск контактов в тексте заявки без нейросети.

Регулярки находят телефоны, почту и ники Telegram в любом привычном виде записи и
приводят их к одному формату. Этим же кодом проверяются контакты от нейросети:
телефон или почта, которых нет в исходном тексте, в карточку не попадут.
"""

import re
from dataclasses import dataclass, field

# --- Телефоны ---

# Российский номер: необязательный префикс +7 / 8 / 7, код из трёх цифр и ещё семь цифр
# с любыми одиночными разделителями: 8 (916) 123-45-67, +7 916 1234567, 89161234567…
# Настоящие коды начинаются на 3, 4, 8, 9; остальные принимаем только с префиксом +7 или 8 —
# в демо пишут и выдуманные номера вроде +7 231 231-12-23
_RU_PHONE = re.compile(
    r"(?<![\d+])"
    r"(?P<prefix>\+\s?7|8|7)?[\s\-]{0,2}"
    r"(?P<open>\()?\s?(?P<code>[2-9]\d{2})\s?\)?"
    r"(?P<rest>(?:[\s\-]{0,2}\d){7})"
    r"(?!\d)"
)
# Зарубежный номер: только с плюсом, чтобы не принять за телефон цену или номер заказа
_INTL_PHONE = re.compile(r"(?<![\d+])\+\s?(?!7)\d{1,3}(?:[\s\-()]{0,2}\d){7,11}(?!\d)")
# Добавочный номер сразу после телефона: «8 495 777-12-34 доб. 105»
_EXTENSION = re.compile(
    r"\s?,?\s?(?:доб\.?|добавочный|вн\.?|ext\.?)\s?(?P<ext>\d{1,5})(?!\d)", re.I
)
# Перед числом стоят реквизиты или номер заказа — это не телефон
_NOT_PHONE_CONTEXT = re.compile(
    r"(?:инн|огрн|огрнип|кпп|бик|счёт|счет|р/с|к/с|№|#|заказ\w*)\W{0,3}$", re.I
)

# --- Почта, в том числе «ivan [at] mail.ru» и «ivan собака mail точка ru» ---

_LOCAL = r"[A-Za-z0-9][A-Za-z0-9._%+\-]*"
_AT = r"(?:\s?@\s?|\s?[\[(<{]\s?(?:at|собака|@)\s?[\])>}]\s?|\s+(?:at|собака)\s+)"
_LABEL = r"[A-Za-z0-9А-Яа-яЁё][A-Za-z0-9А-Яа-яЁё\-]*"
_DOT = r"(?:\.|\s?[\[(]\s?(?:dot|точка)\s?[\])]\s?|\s+(?:dot|точка)\s+)"
_EMAIL = re.compile(
    rf"(?<![\w.])(?P<local>{_LOCAL}){_AT}(?P<domain>{_LABEL}(?:{_DOT}{_LABEL})*{_DOT}[A-Za-zА-Яа-яЁё]{{2,}})(?![\w])",
    re.I,
)
_DOT_WORD = re.compile(r"\s?[\[(]\s?(?:dot|точка)\s?[\])]\s?|\s+(?:dot|точка)\s+", re.I)

# --- Telegram: @username, t.me/username или «телеграм: username» ---

_USERNAME = r"[A-Za-z][A-Za-z0-9_]{4,31}"
_TG_AT = re.compile(rf"(?<![\w@.])@(?P<user>{_USERNAME})(?![\w.@])")
_TG_LINK = re.compile(rf"(?:https?://)?(?:t|telegram)\.me/(?P<user>{_USERNAME})(?!\w)", re.I)
_TG_WORD = re.compile(
    rf"(?<!\w)(?:telegram|телеграм\w*|телег\w*|тг|tg)\s?[:\-—]?\s?(?P<user>{_USERNAME})(?!\w)", re.I
)
_USERNAME_ONLY = re.compile(rf"^@?{_USERNAME}$")


@dataclass
class Found:
    value: str
    start: int
    end: int


@dataclass
class FoundContacts:
    phones: list[Found] = field(default_factory=list)
    emails: list[Found] = field(default_factory=list)
    telegram: list[Found] = field(default_factory=list)


def format_ru_phone(digits: str) -> str:
    """10 цифр без префикса → +7 (916) 123-45-67."""
    return f"+7 ({digits[:3]}) {digits[3:6]}-{digits[6:8]}-{digits[8:]}"


def normalize_phone(raw: str) -> str | None:
    """Приводит телефон к одному виду или возвращает None, если это не телефон."""
    digits = re.sub(r"\D", "", raw)
    plus = raw.lstrip().startswith("+")
    if len(digits) == 11 and digits[0] in "78" and (digits[0] == "7" or not plus):
        # С префиксом подходит любой код, кроме начинающихся на 0 и 1
        digits = digits[1:]
        if digits[0] in "01":
            return None
    elif len(digits) == 10 and not plus:
        if digits[0] not in "3489":
            return None
    elif plus and 9 <= len(digits) <= 14 and not digits.startswith("7"):
        return "+" + digits
    else:
        return None
    return format_ru_phone(digits)


def _phones(text: str) -> list[Found]:
    found: list[Found] = []
    for m in _RU_PHONE.finditer(text):
        if _NOT_PHONE_CONTEXT.search(text[max(0, m.start() - 14) : m.start()]):
            continue
        # Без префикса и скобок принимаем только мобильные: иначе 10 цифр подряд
        # слишком часто оказываются номером договора
        if not m["prefix"] and not m["open"] and m["code"][0] != "9":
            continue
        # Коды не на 3, 4, 8, 9 — только с явным +7 или 8: иначе это скорее число из текста
        prefix = (m["prefix"] or "").replace(" ", "")
        if m["code"][0] not in "3489" and prefix not in {"+7", "8"}:
            continue
        digits = m["code"] + re.sub(r"\D", "", m["rest"])
        value, end = format_ru_phone(digits), m.end()
        ext = _EXTENSION.match(text, end)
        if ext:
            value, end = f"{value}, доб. {ext['ext']}", ext.end()
        found.append(Found(value, m.start(), end))
    for m in _INTL_PHONE.finditer(text):
        if any(f.start <= m.start() < f.end for f in found):
            continue
        value = normalize_phone(m.group())
        if value:
            found.append(Found(value, m.start(), m.end()))
    return sorted(found, key=lambda f: f.start)


def normalize_email(local: str, domain: str) -> str:
    domain = _DOT_WORD.sub(".", domain)
    return f"{local}@{domain}".lower().replace(" ", "")


def _emails(text: str) -> list[Found]:
    return [
        Found(normalize_email(m["local"], m["domain"]), m.start(), m.end())
        for m in _EMAIL.finditer(text)
    ]


def _telegram(text: str, taken: list[Found]) -> list[Found]:
    found: list[Found] = []
    for pattern in (_TG_LINK, _TG_AT, _TG_WORD):
        for m in pattern.finditer(text):
            # Ник внутри адреса почты или уже найденной ссылки не считаем
            if any(f.start <= m.start("user") < f.end for f in [*taken, *found]):
                continue
            found.append(Found("@" + m["user"], m.start(), m.end()))
    return sorted(found, key=lambda f: f.start)


def _unique(items: list[Found], key=str.lower) -> list[Found]:
    seen: set[str] = set()
    out = []
    for item in items:
        k = key(item.value)
        if k not in seen:
            seen.add(k)
            out.append(item)
    return out


def find_contacts(text: str) -> FoundContacts:
    emails = _unique(_emails(text))
    phones = _unique(_phones(text))
    return FoundContacts(
        phones=phones, emails=emails, telegram=_unique(_telegram(text, [*emails, *phones]))
    )


# --- Проверка контактов, которые предложила нейросеть ---


def phone_in_text(phone: str, text: str) -> str | None:
    """Нормализованный телефон, если его цифры действительно есть в тексте.

    Нейросеть может вернуть номер как в тексте — с добавочным или в непривычной записи,
    поэтому сначала разбираем её ответ теми же регулярками.
    """
    text_digits = re.sub(r"\D", "", text)
    parsed = _phones(phone)
    value = parsed[0].value if parsed else normalize_phone(phone)
    if value:
        tail = re.sub(r"\D", "", value.split(",")[0])[-10:]
        return value if tail in text_digits else None
    # Привести к одному виду не вышло, но цифры номера в тексте есть — оставляем как написано
    digits = re.sub(r"\D", "", phone)
    return phone.strip() if len(digits) >= 7 and digits in text_digits else None


def email_in_text(email: str, text: str) -> str | None:
    """Адрес, если он есть в тексте, — в том числе записанный как «anna [at] mail.ru»."""
    parsed = _emails(email)
    email = parsed[0].value if parsed else email.strip().lower()
    for f in _emails(text):
        if f.value == email:
            return email
    return None


def telegram_in_text(handle: str, text: str) -> str | None:
    handle = handle.strip()
    if handle.lower().startswith(("https://t.me/", "t.me/")):
        handle = handle.rsplit("/", 1)[-1]
    if not _USERNAME_ONLY.match(handle):
        return None
    user = handle.lstrip("@")
    if re.search(rf"(?<![\w]){re.escape(user)}(?!\w)", text, re.I):
        return "@" + user
    return None


def name_spans(name: str, text: str) -> list[tuple[int, int]]:
    """Где в тексте встречается имя. Пусто — имени в тексте нет, нейросеть его угадала.

    Сравниваем по началу слова, чтобы «Анна» нашлась и в подписи «Анны».
    """
    spans = []
    for word in re.findall(r"[A-Za-zА-Яа-яЁё\-]{2,}", name):
        stem = word[: max(3, len(word) - 2)]
        m = re.search(rf"(?<![\w]){re.escape(stem)}[\w\-]*", text, re.I)
        if not m:
            return []
        spans.append((m.start(), m.end()))
    return spans
