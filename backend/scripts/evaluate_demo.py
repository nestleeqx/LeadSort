"""Прогон 25 демо-заявок «Пикселя» через нейросеть и сверка с правильными ответами.

    uv run python scripts/evaluate_demo.py --report ../../portfolio-assets/leadsort/demo-report.html

Что делает:
- разбирает каждую заявку тем провайдером, что указан в .env (LLM_PROVIDER);
- сравнивает тип, срочность и контакты с полем expected в app/seed/pixel-leads.json;
- сохраняет разборы в app/seed/pixel-leads.results.json — демо-доска берёт их оттуда,
  поэтому первый визит не тратит токены;
- собирает HTML-отчёт: текст заявки, правильный ответ и что определила нейросеть.

Кеш — в памяти процесса, чтобы прогон каждый раз шёл через модель.
"""

import argparse
import asyncio
import html
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.llm import create_provider  # noqa: E402
from app.services.triage import triage_lead  # noqa: E402

SEED_DIR = Path(__file__).resolve().parents[1] / "app" / "seed"
LEADS = SEED_DIR / "pixel-leads.json"
RESULTS = SEED_DIR / "pixel-leads.results.json"

TYPES = {
    "new_site": "Новый сайт",
    "improvement": "Доработка",
    "support": "Поддержка",
    "question": "Вопрос",
    "spam": "Спам",
}
URGENCY = {"high": "высокая", "medium": "средняя", "low": "низкая"}
CHANNELS = {"form": "Форма", "telegram": "Telegram", "manual": "Вручную"}


def contacts_ok(expected: dict, contacts: dict) -> bool:
    """Все ожидаемые контакты найдены (лишние не считаются ошибкой)."""
    for key in ("phones", "emails", "telegram"):
        found = {v.lower() for v in contacts[key]}
        if any(v.lower() not in found for v in expected[key]):
            return False
    return True


async def run(concurrency: int) -> tuple[str, list[dict]]:
    provider = create_provider(get_settings())
    redis = fakeredis.FakeAsyncRedis(decode_responses=True)
    leads = json.loads(LEADS.read_text(encoding="utf-8"))
    gate = asyncio.Semaphore(concurrency)

    async def one(lead: dict) -> dict:
        async with gate:
            started = time.perf_counter()
            result = await triage_lead(provider, redis, lead["text"])
            elapsed = round((time.perf_counter() - started) * 1000)
        return compare(
            lead,
            {
                "triage": result.triage.model_dump(),
                "highlights": [h.model_dump() for h in result.highlights],
                "notes": result.notes,
                "method": result.method,
                "elapsed_ms": elapsed,
            },
        )

    try:
        rows = await asyncio.gather(*(one(lead) for lead in leads))
    finally:
        await provider.aclose()
    return f"{provider.name}:{provider.model}", list(rows)


def compare(lead: dict, result: dict) -> dict:
    triage, expected = result["triage"], lead["expected"]
    return {
        "lead": lead,
        "result": result,
        "type_ok": triage["type"] == expected["type"],
        "urgency_ok": triage["urgency"] == expected["urgency"],
        "contacts_ok": contacts_ok(expected, triage["contacts"]),
    }


def load_saved() -> tuple[str, list[dict]]:
    """Сохранённые разборы — чтобы пересобрать отчёт без запросов к модели."""
    saved = json.loads(RESULTS.read_text(encoding="utf-8"))
    leads = json.loads(LEADS.read_text(encoding="utf-8"))
    return saved["model"], [compare(lead, saved["results"][lead["id"]]) for lead in leads]


def save_results(model: str, rows: list[dict]) -> None:
    data = {
        "model": model,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "results": {row["lead"]["id"]: row["result"] for row in rows},
    }
    RESULTS.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _mark(ok: bool) -> str:
    return '<span class="ok">✓</span>' if ok else '<span class="bad">✗</span>'


def render_report(model: str, rows: list[dict]) -> str:
    total = len(rows)
    types = sum(r["type_ok"] for r in rows)
    urgency = sum(r["urgency_ok"] for r in rows)
    contacts = sum(r["contacts_ok"] for r in rows)
    ai_rows = [r for r in rows if r["result"]["method"] == "ai"]
    avg = sum(r["result"]["elapsed_ms"] for r in ai_rows) / max(1, len(ai_rows)) / 1000
    notify = sum(r["result"]["triage"]["notify"] for r in rows)

    body = []
    for r in rows:
        lead, t = r["lead"], r["result"]["triage"]
        exp = lead["expected"]
        c = t["contacts"]
        contact_list = [c["name"], *c["phones"], *c["emails"], *c["telegram"]]
        details = ""
        if t["reply_draft"]:
            details = (
                "<details><summary>Черновик ответа</summary>"
                f"<p class='pre'>{html.escape(t['reply_draft'])}</p></details>"
            )
        notes = "".join(f"<p class='note'>{html.escape(n)}</p>" for n in r["result"]["notes"])
        bell = " · 🔔" if t["notify"] else ""
        method = (
            "правила"
            if r["result"]["method"] == "rules"
            else (f"{r['result']['elapsed_ms'] / 1000:.1f} с")
        )
        body.append(
            f"""<tr class="{"" if r["type_ok"] else "miss"}">
<td class="id">{lead["id"]}<br><span class="muted">{CHANNELS[lead["channel"]]}</span></td>
<td class="text"><p class="pre">{html.escape(lead["text"])}</p></td>
<td class="ans">{TYPES[exp["type"]]}<br><span class="muted">{URGENCY[exp["urgency"]]}</span></td>
<td class="ans">{_mark(r["type_ok"])} {TYPES[t["type"]]}<br>
<span class="muted">{_mark(r["urgency_ok"])} {URGENCY[t["urgency"]]}{bell}</span></td>
<td>{_mark(r["contacts_ok"])} {html.escape(", ".join(v for v in contact_list if v) or "—")}
<p class="muted">Бюджет: {html.escape(t["budget"])}<br>Сроки: {html.escape(t["deadline"])}</p></td>
<td><p>{html.escape(t["summary"])}</p>
<p class="muted">{html.escape(t["urgency_reason"])}</p>{details}{notes}
<p class="muted">{method}</p></td>
</tr>"""
        )

    return f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LeadSort — проверка 25 демо-заявок</title>
<style>
body {{ margin: 0; padding: 24px 16px 48px; background: #f5f5f0; color: #141414;
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
main {{ max-width: 1280px; margin: 0 auto; }}
h1 {{ font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }}
.lead {{ color: #4a4a44; margin: 0 0 20px; }}
.stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px;
  margin-bottom: 24px; }}
.stat {{ background: #fff; border: 1px solid #e4e4dc; border-radius: 12px; padding: 14px 16px; }}
.stat b {{ display: block; font-size: 24px; letter-spacing: -0.02em; }}
.stat span {{ color: #85857d; font-size: 12px; }}
.wrap {{ overflow-x: auto; background: #fff; border: 1px solid #e4e4dc; border-radius: 12px; }}
table {{ border-collapse: collapse; width: 100%; min-width: 1100px; }}
th {{ text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
  color: #85857d; font-weight: 500; padding: 10px 12px; border-bottom: 1px solid #e4e4dc; }}
td {{ vertical-align: top; padding: 12px; border-bottom: 1px solid #efefe9; }}
tr.miss td {{ background: #fbeceb; }}
td.id {{ white-space: nowrap; font-weight: 600; }}
td.ans {{ white-space: nowrap; }}
td.text {{ width: 32%; }}
.pre {{ white-space: pre-wrap; margin: 0; }}
.muted {{ color: #85857d; font-size: 12px; margin: 4px 0 0; }}
.ok {{ color: #4f7d0b; font-weight: 700; }}
.bad {{ color: #b93a2f; font-weight: 700; }}
.note {{ background: #fcf1df; color: #a45a07; border-radius: 6px; padding: 4px 8px;
  font-size: 12px; }}
details {{ margin-top: 6px; }} summary {{ cursor: pointer; color: #4a4a44; font-size: 12px; }}
details p {{ background: #f5f5f0; border-radius: 8px; padding: 8px 10px; margin-top: 6px; }}
</style></head>
<body><main>
<h1>Проверка 25 демо-заявок</h1>
<p class="lead">Веб-студия «Пиксель». Модель: {html.escape(model)}.
Красным выделены заявки, где тип не совпал с правильным ответом.</p>
<div class="stats">
<div class="stat"><b>{types} из {total}</b><span>тип определён верно (цель — 22)</span></div>
<div class="stat"><b>{urgency} из {total}</b><span>срочность совпала</span></div>
<div class="stat"><b>{contacts} из {total}</b><span>все контакты найдены</span></div>
<div class="stat"><b>{notify}</b><span>уведомлений в Telegram</span></div>
<div class="stat"><b>{avg:.1f} с</b><span>в среднем на разбор нейросетью</span></div>
</div>
<div class="wrap"><table>
<tr><th>№</th><th>Текст заявки</th><th>Правильно</th><th>Нейросеть</th><th>Контакты</th>
<th>Резюме</th></tr>
{"".join(body)}
</table></div>
</main></body></html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", type=Path, help="куда сохранить HTML-отчёт")
    parser.add_argument("--concurrency", type=int, default=5)
    parser.add_argument("--no-save", action="store_true", help="не перезаписывать results.json")
    parser.add_argument(
        "--from-saved", action="store_true", help="не звать модель, взять разборы из results.json"
    )
    args = parser.parse_args()

    if args.from_saved:
        model, rows = load_saved()
        args.no_save = True
    else:
        model, rows = asyncio.run(run(args.concurrency))
    total = len(rows)
    print(f"Модель: {model}")
    print(f"Тип верно: {sum(r['type_ok'] for r in rows)} из {total}")
    print(f"Срочность совпала: {sum(r['urgency_ok'] for r in rows)} из {total}")
    print(f"Контакты найдены: {sum(r['contacts_ok'] for r in rows)} из {total}")
    for r in rows:
        if not (r["type_ok"] and r["urgency_ok"] and r["contacts_ok"]):
            t, exp = r["result"]["triage"], r["lead"]["expected"]
            print(
                f"  {r['lead']['id']}: тип {t['type']} (нужно {exp['type']}), "
                f"срочность {t['urgency']} (нужно {exp['urgency']}), "
                f"контакты {'ок' if r['contacts_ok'] else 'не все'}"
            )

    if not args.no_save:
        save_results(model, rows)
        print(f"Разборы сохранены: {RESULTS}")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(render_report(model, rows), encoding="utf-8")
        print(f"Отчёт: {args.report.resolve()}")


if __name__ == "__main__":
    main()
