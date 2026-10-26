"""Демо-набор «Пикселя»: 25 заявок с правильными ответами и сохранённые разборы нейросети."""

import json
from pathlib import Path

import pytest

from app.schemas import Triage
from app.services.contacts import find_contacts

SEED = Path(__file__).resolve().parents[1] / "app" / "seed"
LEADS = json.loads((SEED / "pixel-leads.json").read_text(encoding="utf-8"))
RESULTS = json.loads((SEED / "pixel-leads.results.json").read_text(encoding="utf-8"))["results"]


def test_demo_set_shape():
    assert len(LEADS) == 25
    assert len({lead["id"] for lead in LEADS}) == 25
    assert {lead["expected"]["type"] for lead in LEADS} == {
        "new_site",
        "improvement",
        "support",
        "question",
        "spam",
    }
    assert {lead["channel"] for lead in LEADS} == {"form", "telegram", "manual"}
    for lead in LEADS:
        assert lead["status"] in {"new", "in_progress", "waiting", "closed", "spam"}
        # Спам лежит в своей колонке, а в колонке «Спам» — только спам
        assert (lead["status"] == "spam") == (lead["expected"]["type"] == "spam"), lead["id"]


@pytest.mark.parametrize("lead", LEADS, ids=[lead["id"] for lead in LEADS])
def test_contacts_found_without_model(lead):
    """Телефоны, почта и ники находятся регулярками в любой записи — без нейросети."""
    found = find_contacts(lead["text"])
    assert [f.value for f in found.phones] == lead["expected"]["phones"]
    assert [f.value for f in found.emails] == lead["expected"]["emails"]
    assert [f.value for f in found.telegram] == lead["expected"]["telegram"]


def test_saved_results_cover_every_lead():
    assert set(RESULTS) == {lead["id"] for lead in LEADS}
    for result in RESULTS.values():
        Triage.model_validate(result["triage"])


def test_saved_results_meet_accuracy_target():
    """Критерий готовности: тип верно определён минимум в 22 заявках из 25."""
    correct = sum(
        RESULTS[lead["id"]]["triage"]["type"] == lead["expected"]["type"] for lead in LEADS
    )
    assert correct >= 22


def test_spam_never_notifies_in_demo():
    for lead in LEADS:
        triage = RESULTS[lead["id"]]["triage"]
        if triage["type"] == "spam":
            assert not triage["notify"], lead["id"]
