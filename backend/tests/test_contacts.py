import pytest

from app.services.contacts import (
    email_in_text,
    find_contacts,
    name_spans,
    phone_in_text,
    telegram_in_text,
)

MOBILE = "+7 (916) 123-45-67"


@pytest.mark.parametrize(
    "text",
    [
        "Мой номер +7 (916) 123-45-67",
        "звоните 89161234567",
        "тел. 8-916-123-45-67, лучше вечером",
        "+7 916 123 45 67",
        "+79161234567",
        "8 (916) 1234567",
        "моб: 916 123 45 67",
        "9161234567 — это я",
        "8 916 12 34 567",
        "Телефон:+7-916-123-4567.",
        "7 916 123-45-67",
    ],
)
def test_mobile_in_any_format(text):
    assert [p.value for p in find_contacts(text).phones] == [MOBILE]


def test_landline_and_toll_free():
    text = "Офис: (495) 123-45-67, горячая линия 8-800-555-35-35"
    assert [p.value for p in find_contacts(text).phones] == [
        "+7 (495) 123-45-67",
        "+7 (800) 555-35-35",
    ]


def test_foreign_phone_needs_plus():
    phones = find_contacts("Минск: +375 29 123-45-67").phones
    assert [p.value for p in phones] == ["+375291234567"]


@pytest.mark.parametrize(
    "text",
    [
        "Бюджет 300 000 – 400 000 рублей",
        "до 150000 руб, сроки 24.10.2026",
        "ИНН 9701234567, КПП 770101001",
        "Заказ №9161234567 не пришёл",
        "работаем с 10:00 до 19:00",
        "Бюджет 8 000 000 ₽",
        "договор 4951234567",
    ],
)
def test_numbers_that_are_not_phones(text):
    assert find_contacts(text).phones == []


def test_two_phones_kept_in_order_without_duplicates():
    text = "8 916 123-45-67 или +7 925 765 43 21, ещё раз: 89161234567"
    assert [p.value for p in find_contacts(text).phones] == [MOBILE, "+7 (925) 765-43-21"]


@pytest.mark.parametrize(
    ("text", "email"),
    [
        ("пишите на Ivan.Petrov@Mail.ru", "ivan.petrov@mail.ru"),
        ("почта: anna [at] yandex.ru", "anna@yandex.ru"),
        ("anna(at)yandex(dot)ru", "anna@yandex.ru"),
        ("olga собака gmail точка com", "olga@gmail.com"),
        ("shop @ kotiki.ru — это наш", "shop@kotiki.ru"),
        ("адрес info@почта.рф", "info@почта.рф"),
    ],
)
def test_email_in_any_format(text, email):
    assert [e.value for e in find_contacts(text).emails] == [email]


@pytest.mark.parametrize(
    ("text", "handle"),
    [
        ("мой телеграм @ivan_petrov", "@ivan_petrov"),
        ("https://t.me/anna_design", "@anna_design"),
        ("пишите в тг: olga_flowers", "@olga_flowers"),
        ("Telegram — SergeyK90", "@SergeyK90"),
    ],
)
def test_telegram(text, handle):
    assert [t.value for t in find_contacts(text).telegram] == [handle]


def test_email_is_not_a_telegram_handle():
    found = find_contacts("почта ivan_petrov@mail.ru")
    assert found.telegram == [] and [e.value for e in found.emails] == ["ivan_petrov@mail.ru"]


def test_telegram_word_without_handle():
    assert find_contacts("в телеграме лучше не писать").telegram == []


def test_spans_point_to_the_source_text():
    text = "Звоните: 8 916 123-45-67"
    phone = find_contacts(text).phones[0]
    assert text[phone.start : phone.end] == "8 916 123-45-67"


def test_ai_contacts_are_checked_against_text():
    text = "Иван, 8 916 123 45 67, ivan@mail.ru, тг @ivan_dev"
    assert phone_in_text("+79161234567", text) == MOBILE
    assert phone_in_text("+7 999 000-00-00", text) is None
    assert email_in_text("IVAN@mail.ru", text) == "ivan@mail.ru"
    assert email_in_text("petrov@mail.ru", text) is None
    assert telegram_in_text("ivan_dev", text) == "@ivan_dev"
    assert telegram_in_text("@other_user", text) is None
    assert telegram_in_text("+79161234567", text) is None


def test_name_matches_other_word_forms():
    assert name_spans("Анна", "С уважением, Анна Смирнова")
    assert name_spans("Анна Смирнова", "от Анны Смирновой")
    assert name_spans("Мария", "Добрый день, нужен сайт") == []


def test_extension_is_kept():
    phones = find_contacts("ООО Ромашка, 8-495-777-12-34 доб. 105, Ольга").phones
    assert [p.value for p in phones] == ["+7 (495) 777-12-34, доб. 105"]


def test_ai_contacts_written_as_in_text_are_accepted():
    text = "почта alina.zerno [at] gmail.com, тел 8-495-777-12-34 доб. 105"
    assert email_in_text("alina.zerno [at] gmail.com", text) == "alina.zerno@gmail.com"
    assert phone_in_text("8-495-777-12-34 доб. 105", text) == "+7 (495) 777-12-34, доб. 105"
