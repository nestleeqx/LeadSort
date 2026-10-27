"use client";

import {
  AtSign,
  Bell,
  BellOff,
  Check,
  CircleHelp,
  Copy,
  KanbanSquare,
  Mail,
  Phone,
  Send,
  Sparkles,
  TriangleAlert,
  User,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatSeconds, NOT_SPECIFIED, TYPES, URGENCY } from "@/lib/labels";
import { SAMPLES } from "@/lib/samples";
import type { Limits, TriageResponse } from "@/lib/types";
import { HighlightedText, HighlightLegend } from "./HighlightedText";
import { useToast } from "./Toast";
import { Button, Panel, SectionLabel } from "./ui";

const DEFAULT_MAX_CHARS = 4000;

function useCopy() {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  return {
    copied,
    copy: async (value: string, what = "Скопировано") => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(value);
        setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
        toast.ok(what);
      } catch {
        toast.error("Не удалось скопировать — выделите текст вручную.");
      }
    },
  };
}

function ContactLine({
  icon,
  value,
  onCopy,
  copied,
}: {
  icon: ReactNode;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Скопировать"
      className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-ink transition-colors hover:bg-sunken"
    >
      <span className="text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{value}</span>
      {copied ? (
        <Check className="size-3.5 text-accent" />
      ) : (
        <Copy className="size-3.5 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const empty = value === NOT_SPECIFIED;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className={`text-sm ${empty ? "text-ink-3" : "font-medium text-ink"}`}>{value}</p>
    </div>
  );
}

function Result({ data, onSend, sending }: { data: TriageResponse; onSend: () => void; sending: boolean }) {
  const { triage: t, notes } = data;
  const { copy, copied } = useCopy();
  const type = TYPES[t.type];
  const urgency = URGENCY[t.urgency];
  const c = t.contacts;
  const hasContacts = c.name || c.phones.length || c.emails.length || c.telegram.length;

  return (
    <div className="rise space-y-5">
      {/* На телефоне уведомление — отдельной полосой под тегами, на широком экране — справа в строке */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${type.badge}`}>{type.label}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${urgency.text}`}>
            <span className={`size-2 rounded-full ${urgency.dot}`} />
            {urgency.label}
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium sm:ml-auto ${
            t.notify ? "bg-ink text-white" : "bg-sunken text-ink-3"
          }`}
        >
          {t.notify ? <Bell className="size-3.5 text-glow" /> : <BellOff className="size-3.5" />}
          {t.notify ? "Уведомим менеджера в Telegram" : "Без уведомления"}
        </span>
      </div>

      <div>
        <p className="text-[15px] leading-relaxed text-ink">{t.summary}</p>
        {t.urgency_reason && <p className="mt-1.5 text-sm text-ink-3">{t.urgency_reason}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <SectionLabel>Контакты</SectionLabel>
          {hasContacts ? (
            <div className="-mx-1.5">
              {c.name && (
                <div className="flex items-center gap-2 px-1.5 py-1 text-sm font-medium">
                  <User className="size-3.5 text-ink-3" />
                  {c.name}
                </div>
              )}
              {c.phones.map((v) => (
                <ContactLine
                  key={v}
                  icon={<Phone className="size-3.5" />}
                  value={v}
                  copied={copied === v}
                  onCopy={() => copy(v, "Телефон скопирован")}
                />
              ))}
              {c.emails.map((v) => (
                <ContactLine
                  key={v}
                  icon={<Mail className="size-3.5" />}
                  value={v}
                  copied={copied === v}
                  onCopy={() => copy(v, "Почта скопирована")}
                />
              ))}
              {c.telegram.map((v) => (
                <ContactLine
                  key={v}
                  icon={<AtSign className="size-3.5" />}
                  value={v}
                  copied={copied === v}
                  onCopy={() => copy(v, "Ник скопирован")}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Контактов в тексте нет</p>
          )}
        </div>
        <div className="grid content-start gap-4">
          <Fact label="Бюджет" value={t.budget} />
          <Fact label="Сроки" value={t.deadline} />
        </div>
      </div>

      {t.missing.length > 0 && (
        <div>
          <SectionLabel>Чего не хватает</SectionLabel>
          <ul className="space-y-1.5">
            {t.missing.map((q) => (
              <li key={q} className="flex gap-2 text-sm text-ink">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-ink-3" />
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.reply_draft && (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <SectionLabel className="">Черновик ответа</SectionLabel>
            <Button
              size="sm"
              variant="ghost"
              icon={
                copied === t.reply_draft ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />
              }
              onClick={() => copy(t.reply_draft, "Ответ скопирован")}
            >
              Скопировать
            </Button>
          </div>
          <div className="rounded-xl border border-line bg-sunken/50 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
            {t.reply_draft}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-xl border border-warn/20 bg-warn-soft px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warn">
            <TriangleAlert className="size-3.5" />
            Поправили за нейросетью
          </p>
          <ul className="space-y-0.5 text-sm text-ink-2">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <p className="mr-auto flex items-center gap-1.5 text-xs text-ink-3">
          <Sparkles className="size-3.5" />
          {data.method === "rules"
            ? "Разобрано по правилам, без нейросети"
            : data.elapsed_ms < 300
              ? "Разобрано мгновенно: такой же текст уже разбирали"
              : `Разобрано за ${formatSeconds(data.elapsed_ms)}`}
        </p>
        <Button size="sm" icon={<KanbanSquare className="size-3.5" />} loading={sending} onClick={onSend}>
          Отправить на доску
        </Button>
      </div>
    </div>
  );
}

function Placeholder({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-5" aria-busy>
        <div className="flex gap-2">
          <div className="skeleton h-7 w-24 rounded-lg" />
          <div className="skeleton h-7 w-36 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-4/5 rounded" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-20 rounded-xl" />
        </div>
        <div className="skeleton h-28 rounded-xl" />
        <p className="text-sm text-ink-3">Нейросеть читает заявку…</p>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft">
        <Wand2 className="size-5 text-accent" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">Здесь появится разбор</p>
        <p className="mt-1 max-w-xs text-sm text-ink-3">
          Тип и срочность, контакты, бюджет и сроки, вопросы клиенту и черновик ответа
        </p>
      </div>
    </div>
  );
}

export function TriageSandbox() {
  const toast = useToast();
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; data: TriageResponse } | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.limits().then(setLimits, () => {});
  }, []);

  const maxChars = limits?.max_lead_chars ?? DEFAULT_MAX_CHARS;
  const trimmed = text.trim();
  const tooLong = trimmed.length > maxChars;

  async function submit() {
    if (!trimmed || tooLong || loading) return;
    setLoading(true);
    // На телефоне результат ниже формы — прокручиваем к нему, чтобы было видно ожидание
    if (window.matchMedia("(max-width: 1023px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    try {
      const data = await api.triage(trimmed);
      setResult({ text: trimmed, data });
      setLimits((l) => (l ? { ...l, triages_left: Math.max(0, l.triages_left - 1) } : l));
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Песочница ничего не сохраняет; эта кнопка создаёт из текста заявку на доске.
  // Разбор берётся из кеша, поэтому карточка на доске появляется уже разобранной.
  async function sendToBoard() {
    if (!result) return;
    setSending(true);
    try {
      const lead = await api.addLead(result.text);
      router.push(`/app?lead=${lead.id}`);
    } catch (e) {
      toast.error(e);
      setSending(false);
    }
  }

  return (
    // Порядок в разметке — для телефона: форма, результат, текст с подсветкой.
    // На широком экране результат справа на всю высоту.
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Panel className="p-4 sm:p-6 lg:col-start-1">
        <label htmlFor="lead-text" className="mb-2 block text-sm font-medium text-ink">
          Текст заявки
        </label>
        <textarea
          id="lead-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          placeholder="Вставьте письмо, сообщение из мессенджера или текст из формы на сайте"
          className="block max-h-[60vh] min-h-56 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink outline-none field-sizing-content transition-shadow placeholder:text-ink-3 focus:border-accent/40 focus:ring-4 focus:ring-accent-soft"
        />
        {/* Обе подписи не переносятся внутри себя: если тесно, вторая уходит на строку ниже целиком */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs whitespace-nowrap tabular-nums">
          <span className={tooLong ? "font-semibold text-danger" : "text-ink-3"}>
            {trimmed.length.toLocaleString("ru-RU")} из {maxChars.toLocaleString("ru-RU")} символов
          </span>
          {limits && <span className="text-ink-3">Осталось разборов в этот час: {limits.triages_left}</span>}
        </div>

        <div className="mt-4">
          <SectionLabel>Примеры</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setText(s.text)}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                  text === s.text
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="primary"
            loading={loading}
            disabled={!trimmed || tooLong}
            onClick={submit}
            icon={<Send className="size-4" />}
          >
            Разобрать
          </Button>
          <span className="hidden text-xs text-ink-3 sm:inline">или Ctrl + Enter</span>
        </div>
      </Panel>

      <div ref={resultRef} className="scroll-mt-4 lg:sticky lg:top-22 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <Panel className="p-4 sm:p-6">
          {result && !loading ? (
            <Result data={result.data} onSend={sendToBoard} sending={sending} />
          ) : (
            <Placeholder loading={loading} />
          )}
        </Panel>
      </div>

      {result && (
        <Panel className="rise p-4 sm:p-6 lg:col-start-1">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <SectionLabel className="">Что нашли в тексте</SectionLabel>
            <HighlightLegend />
          </div>
          <HighlightedText text={result.text} highlights={result.data.highlights} />
        </Panel>
      )}
    </div>
  );
}
