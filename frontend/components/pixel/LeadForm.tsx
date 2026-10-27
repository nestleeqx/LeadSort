"use client";

import {
  ArrowRight,
  AtSign,
  Bell,
  BellOff,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  Phone,
  Send,
  Sparkles,
  User,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { formatSeconds, NOT_SPECIFIED, TYPES, URGENCY } from "@/lib/labels";
import { randomTestLead, type TestLead } from "@/lib/pixelTests";
import type { LeadDetail } from "@/lib/types";
import { LogoMark } from "../Logo";

const MAX_MESSAGE = 3000;
const EMPTY: TestLead = { name: "", contact: "", message: "" };

const FIELD =
  "w-full rounded-xl border border-px-ink/15 bg-white px-4 py-3 text-[15px] text-px-ink outline-none transition-colors placeholder:text-px-ink/35 focus:border-px disabled:bg-px-soft/40";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Функция опроса — вне компонента: панель перерисовывается 10 раз в секунду (счётчик),
// и новая функция на каждой отрисовке не давала таймеру SWR сработать
const panelRefresh = (latest?: LeadDetail) => (latest?.state === "done" || latest?.state === "error" ? 0 : 1000);

type Sent = { id: string; name: string; at: number };

/** Секунды с момента отправки — для строки «на доске через 3,4 с». */
function useElapsed(since: number | null, running: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (since === null || !running) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [since, running]);
  return since === null ? 0 : Math.max(0, now - since);
}

function Step({ done, active, children }: { done: boolean; active?: boolean; children: ReactNode }) {
  return (
    <li className={`flex items-center gap-2.5 text-sm ${done || active ? "text-ink" : "text-ink-3"}`}>
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-accent" />
      ) : active ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
      ) : (
        <Circle className="size-4 shrink-0 text-line-strong" />
      )}
      {children}
    </li>
  );
}

/** Что увидел менеджер: заявка проходит путь «получена → разобрана → на доске». */
function ManagerPanel({ sent }: { sent: Sent | null }) {
  const { data: lead } = useSWR<LeadDetail>(sent ? ["lead", sent.id] : null, () => api.lead(sent!.id), {
    refreshInterval: panelRefresh,
  });
  const done = lead?.state === "done";
  const failed = lead?.state === "error";
  const elapsed = useElapsed(sent?.at ?? null, !!sent && !done && !failed);
  // Время до появления на доске фиксируем в момент, когда увидели разбор
  const [doneIn, setDoneIn] = useState<{ id: string; ms: number } | null>(null);
  if (sent && done && doneIn?.id !== sent.id) setDoneIn({ id: sent.id, ms: Math.max(elapsed, lead.elapsed_ms ?? 0) });
  const t = done ? lead.triage : null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-canvas p-4 font-sans text-ink sm:p-6">
      <div className="flex items-center gap-2">
        <LogoMark className="size-6 shrink-0" />
        <p className="font-semibold whitespace-nowrap">Что увидел менеджер</p>
        {/* На телефоне метки нет: знак LeadSort слева и так подписывает панель */}
        <span className="ml-auto shrink-0 rounded-md bg-surface px-2 py-0.5 text-[11px] whitespace-nowrap text-ink-3 max-sm:hidden">
          демо LeadSort
        </span>
      </div>

      {!sent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-surface">
            <Wand2 className="size-5 text-ink-3" />
          </span>
          <p className="max-w-xs text-sm text-ink-2">
            Отправьте заявку — здесь появится, как её увидит менеджер студии: тип, срочность, контакты и черновик
            ответа. Обычно на это уходит 3–5 секунд.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col">
          <ol className="space-y-2">
            <Step done>Заявка получена с формы на сайте</Step>
            <Step done={done || failed} active={!done && !failed}>
              {done
                ? lead.method === "rules"
                  ? "Разобрана по правилам, без нейросети"
                  : `Нейросеть разобрала за ${formatSeconds(lead.elapsed_ms ?? 0)}`
                : failed
                  ? "Нейросеть не ответила — заявка ждёт на доске"
                  : `Нейросеть разбирает… ${formatSeconds(elapsed)}`}
            </Step>
            <Step done={done}>
              {done && doneIn
                ? `На доске через ${formatSeconds(doneIn.ms)} после отправки`
                : "Появится на доске разобранной"}
            </Step>
          </ol>

          {t ? (
            <div className="rise mt-5 rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${TYPES[t.type].badge}`}>
                  {TYPES[t.type].label}
                </span>
                {t.type !== "spam" && (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${URGENCY[t.urgency].text}`}>
                    <span className={`size-1.5 rounded-full ${URGENCY[t.urgency].dot}`} />
                    {URGENCY[t.urgency].label}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed">{t.summary}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                {(t.contacts.name ||
                  t.contacts.phones.length + t.contacts.emails.length + t.contacts.telegram.length > 0) && (
                  <>
                    <dt className="text-ink-3">Контакты</dt>
                    {/* Каждый контакт — своей строкой: номер не разрывается, длинная почта переносится внутри */}
                    <dd className="min-w-0 space-y-0.5">
                      {t.contacts.name && <span className="block">{t.contacts.name}</span>}
                      {t.contacts.phones.map((v) => (
                        <span key={v} className="block whitespace-nowrap">
                          {v}
                        </span>
                      ))}
                      {[...t.contacts.emails, ...t.contacts.telegram].map((v) => (
                        <span key={v} className="block break-all">
                          {v}
                        </span>
                      ))}
                    </dd>
                  </>
                )}
                {t.budget !== NOT_SPECIFIED && (
                  <>
                    <dt className="text-ink-3">Бюджет</dt>
                    <dd>{t.budget}</dd>
                  </>
                )}
                {t.deadline !== NOT_SPECIFIED && (
                  <>
                    <dt className="text-ink-3">Сроки</dt>
                    <dd>{t.deadline}</dd>
                  </>
                )}
              </dl>
              {t.missing.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="text-ink-3">Уточнить у клиента</p>
                  <ul className="mt-1 space-y-1 text-ink-2">
                    {t.missing.slice(0, 2).map((q) => (
                      <li key={q} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" />
                        {q}
                      </li>
                    ))}
                  </ul>
                  {t.missing.length > 2 && (
                    <p className="mt-1 text-xs text-ink-3">
                      и ещё {t.missing.length - 2} — в карточке на доске, вместе с черновиком ответа
                    </p>
                  )}
                </div>
              )}
              <p
                className={`mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs ${
                  t.notify ? "font-medium text-danger" : "text-ink-3"
                }`}
              >
                {t.notify ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                {t.notify
                  ? "Срочная — менеджер получает уведомление в Telegram"
                  : t.type === "spam"
                    ? "Спам — ушла в отдельную колонку, без уведомления"
                    : "Без уведомления — ждёт в колонке «Новая»"}
              </p>
            </div>
          ) : (
            !failed && (
              <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface p-4" aria-busy>
                <div className="skeleton h-5 w-40 rounded" />
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-3/4 rounded" />
              </div>
            )
          )}

          <Link
            href={`/app?lead=${sent.id}`}
            className="mt-5 inline-flex h-11 items-center justify-center gap-1.5 self-stretch rounded-xl bg-accent px-4 text-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,.6)] transition-colors hover:bg-accent-hover sm:h-10 sm:self-start"
          >
            Открыть на доске
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function LeadForm() {
  const [values, setValues] = useState<TestLead>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"typing" | "sending" | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const disabled = busy !== null;

  async function submit(data: TestLead) {
    if (!data.message.trim() && !data.contact.trim()) {
      setError("Напишите, что нужно сделать, или оставьте контакт для связи.");
      return;
    }
    setError(null);
    setBusy("sending");
    try {
      const at = Date.now();
      const lead = await api.submitForm(data);
      setSent({ id: lead.id, name: data.name.trim(), at });
      // На телефоне панель менеджера ниже формы — показываем её
      if (window.matchMedia("(max-width: 1023px)").matches) {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  /** Тестовая заявка «печатается» в поля и отправляется — так видно весь путь. */
  async function sendTest() {
    const lead = randomTestLead();
    setSent(null);
    setError(null);
    setBusy("typing");
    let current = EMPTY;
    for (const key of ["name", "contact", "message"] as const) {
      const text = lead[key];
      const step = Math.max(1, Math.ceil(text.length / 30));
      for (let i = step; i < text.length + step; i += step) {
        current = { ...current, [key]: text.slice(0, i) };
        setValues(current);
        await sleep(18);
      }
    }
    await sleep(250);
    await submit(lead);
  }

  function reset() {
    setValues(EMPTY);
    setSent(null);
    setError(null);
  }

  const set = (key: keyof TestLead) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const contactIcon = values.contact.includes("@") ? (
    values.contact.trim().startsWith("@") ? (
      <AtSign className="size-4" />
    ) : (
      <Mail className="size-4" />
    )
  ) : (
    <Phone className="size-4" />
  );

  return (
    // minmax(0, 1fr): колонки сжимаются до ширины экрана, а не растягиваются по содержимому
    <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(values);
        }}
        className="rounded-2xl border border-px-ink/15 bg-white p-4 sm:p-6"
      >
        {sent && !busy ? (
          <div className="rise flex h-full flex-col items-start justify-center gap-3 py-6">
            <span className="grid size-12 place-items-center rounded-2xl bg-px-soft text-px">
              <CheckCircle2 className="size-6" />
            </span>
            <h3 className="text-xl font-semibold">Спасибо{sent.name ? `, ${sent.name}` : ""}! Заявка отправлена</h3>
            <p className="text-px-ink/65">Менеджер ответит в течение часа в рабочее время.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-2 inline-flex h-11 items-center rounded-xl border border-px-ink/15 px-5 font-semibold transition-colors hover:border-px-ink/30"
            >
              Отправить ещё одну
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="relative block">
              <span className="sr-only">Имя</span>
              <User className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-px-ink/35" />
              <input
                value={values.name}
                onChange={set("name")}
                disabled={disabled}
                maxLength={80}
                placeholder="Как к вам обращаться"
                autoComplete="name"
                className={`${FIELD} pl-11`}
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Контакт</span>
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-px-ink/35">
                {contactIcon}
              </span>
              <input
                value={values.contact}
                onChange={set("contact")}
                disabled={disabled}
                maxLength={120}
                placeholder="Телефон, почта или @ник"
                className={`${FIELD} pl-11`}
              />
            </label>
            <label className="block">
              <span className="sr-only">Задача</span>
              <textarea
                value={values.message}
                onChange={set("message")}
                disabled={disabled}
                maxLength={MAX_MESSAGE}
                placeholder="Что нужно сделать: новый сайт, доработка, поддержка? Сроки и бюджет — если уже знаете"
                className={`${FIELD} field-sizing-content min-h-36 resize-none leading-relaxed`}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            {/* На телефоне кнопки на всю ширину, одна под другой */}
            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="submit"
                disabled={disabled}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-px px-6 font-semibold whitespace-nowrap text-white transition-colors hover:bg-px-hover disabled:opacity-60"
              >
                {busy === "sending" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Отправить заявку
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={disabled}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-px/50 px-4 text-sm font-semibold whitespace-nowrap text-px transition-colors hover:bg-px-soft disabled:opacity-60"
              >
                {busy === "typing" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Отправить тестовую заявку
              </button>
            </div>
            <p className="text-xs leading-relaxed text-px-ink/45">
              Тестовая заявка заполнит форму случайным примером: новый сайт, поломка, вопрос или спам.
            </p>
          </div>
        )}
      </form>

      <div ref={panelRef} className="scroll-mt-20">
        <ManagerPanel key={sent?.id ?? "empty"} sent={sent} />
      </div>
    </div>
  );
}
