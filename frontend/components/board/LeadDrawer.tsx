"use client";

import {
  AlertCircle,
  AtSign,
  Bell,
  BellOff,
  Check,
  Copy,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  TriangleAlert,
  Undo2,
  User,
  X,
} from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { CHANNELS, COLUMNS, FIELDS, TYPES, URGENCY, formatDateTime, formatSeconds } from "@/lib/labels";
import { maskPhone, maskTelegram } from "@/lib/phone";
import type { Column, Lead, LeadDetail, LeadType, Triage, TriageField, Urgency } from "@/lib/types";
import { useConfirm } from "../Confirm";
import { HighlightedText, HighlightLegend } from "../HighlightedText";
import { useToast } from "../Toast";
import { Button, Panel, SectionLabel } from "../ui";

type Draft = {
  type: LeadType;
  urgency: Urgency;
  urgency_reason: string;
  name: string;
  phones: string[];
  emails: string[];
  telegram: string[];
  budget: string;
  deadline: string;
  summary: string;
  missing: string;
  reply_draft: string;
};

const lines = (value: string) =>
  value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const clean = (values: string[]) => values.map((s) => s.trim()).filter(Boolean);
// Недонабранный по маске номер («+7 (9») не сохраняем
const cleanPhones = (values: string[]) => clean(values).filter((v) => v.replace(/\D/g, "").length >= 5);

function toDraft(t: Triage): Draft {
  return {
    type: t.type,
    urgency: t.urgency,
    urgency_reason: t.urgency_reason,
    name: t.contacts.name,
    phones: [...t.contacts.phones],
    emails: [...t.contacts.emails],
    telegram: [...t.contacts.telegram],
    budget: t.budget,
    deadline: t.deadline,
    summary: t.summary,
    missing: t.missing.join("\n"),
    reply_draft: t.reply_draft,
  };
}

/** Только изменённые поля — сервер запишет их в «поправлено вручную». */
function toPatch(t: Triage, d: Draft): Partial<Omit<Triage, "notify">> {
  const next: Omit<Triage, "notify"> = {
    type: d.type,
    urgency: d.urgency,
    urgency_reason: d.urgency_reason.trim(),
    contacts: {
      name: d.name.trim(),
      phones: cleanPhones(d.phones),
      emails: clean(d.emails),
      telegram: clean(d.telegram),
    },
    budget: d.budget.trim(),
    deadline: d.deadline.trim(),
    summary: d.summary.trim(),
    missing: lines(d.missing),
    reply_draft: d.reply_draft.trim(),
  };
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (JSON.stringify(next[key]) !== JSON.stringify(t[key])) patch[key] = next[key];
  }
  return patch;
}

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-line-strong";
// Текстовые поля не растягиваются вручную — высота сама подстраивается под текст
const AREA = `${INPUT} resize-none field-sizing-content leading-relaxed`;

/** Список однотипных контактов: каждое значение — своё поле, «+» добавляет ещё одно. */
function ContactList({
  icon,
  values,
  onChange,
  placeholder,
  addLabel,
  format,
  inputMode,
}: {
  icon: ReactNode;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  addLabel: string;
  format?: (value: string) => string;
  inputMode?: "tel" | "email" | "text";
}) {
  const rows = values.length ? values : [""];
  const set = (index: number, value: string) =>
    onChange(rows.map((v, i) => (i === index ? (format ? format(value) : value) : v)));

  return (
    <div className="space-y-1.5">
      {rows.map((value, i) => (
        <div key={i} className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">{icon}</span>
          <input
            value={value}
            onChange={(e) => set(i, e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete="off"
            className={`${INPUT} pr-9 pl-9`}
          />
          {(rows.length > 1 || value) && (
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              aria-label="Убрать"
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {rows[rows.length - 1] && (
        <button
          type="button"
          onClick={() => onChange([...rows, ""])}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <Plus className="size-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  edited,
  hint,
  children,
}: {
  label: string;
  edited?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <SectionLabel className="">{label}</SectionLabel>
        {edited && (
          <span className="rounded bg-info-soft px-1.5 py-px text-[10px] font-medium text-info">изменено</span>
        )}
        {hint && <span className="ml-auto text-[11px] text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            value === o.value
              ? "border-ink bg-ink text-white"
              : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TriageForm({
  lead,
  triage,
  onSaved,
}: {
  lead: LeadDetail;
  triage: Triage;
  onSaved: (lead: LeadDetail) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => toDraft(triage));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const patch = toPatch(triage, draft);
  const dirty = Object.keys(patch).length > 0;
  const edited = (f: TriageField) => lead.edited.includes(f);
  const set =
    <K extends keyof Draft>(key: K) =>
    (value: Draft[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));
  const text = (key: "urgency_reason" | "name" | "budget" | "deadline" | "summary" | "missing" | "reply_draft") => ({
    value: draft[key],
    onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value })),
  });

  async function save() {
    setSaving(true);
    try {
      const saved = await api.editLead(lead.id, patch);
      onSaved(saved);
      toast.ok("Изменения сохранены");
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.reply_draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.ok("Ответ скопирован");
    } catch {
      toast.error("Не удалось скопировать — выделите текст вручную.");
    }
  }

  const notify = draft.urgency === "high" && draft.type !== "spam";

  return (
    <div className="space-y-5">
      <Field label={FIELDS.type} edited={edited("type")}>
        <Segmented
          value={draft.type}
          onChange={set("type")}
          options={(Object.keys(TYPES) as LeadType[]).map((t) => ({ value: t, label: TYPES[t].label }))}
        />
      </Field>

      <Field label={FIELDS.urgency} edited={edited("urgency") || edited("urgency_reason")}>
        <Segmented
          value={draft.urgency}
          onChange={set("urgency")}
          options={(Object.keys(URGENCY) as Urgency[]).map((u) => ({
            value: u,
            label: (
              <>
                <span className={`size-1.5 rounded-full ${URGENCY[u].dot}`} />
                {URGENCY[u].short}
              </>
            ),
          }))}
        />
        <input {...text("urgency_reason")} placeholder="Почему такая срочность" className={`${INPUT} mt-2`} />
        <p className={`mt-2 inline-flex items-center gap-1.5 text-xs ${notify ? "text-ink" : "text-ink-3"}`}>
          {notify ? <Bell className="size-3.5 text-danger" /> : <BellOff className="size-3.5" />}
          {notify ? "Срочная: менеджер получает уведомление в Telegram" : "Без уведомления в Telegram"}
        </p>
      </Field>

      <Field label={FIELDS.summary} edited={edited("summary")}>
        <textarea {...text("summary")} rows={3} className={`${AREA} min-h-20`} />
      </Field>

      <Field label={FIELDS.contacts} edited={edited("contacts")}>
        <div className="grid items-start gap-2 sm:grid-cols-2">
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input {...text("name")} placeholder="Имя" autoComplete="off" className={`${INPUT} pl-9`} />
          </div>
          <ContactList
            icon={<Phone className="size-4" />}
            values={draft.phones}
            onChange={set("phones")}
            placeholder="+7 (___) ___-__-__"
            addLabel="Ещё телефон"
            format={maskPhone}
            inputMode="tel"
          />
          <ContactList
            icon={<Mail className="size-4" />}
            values={draft.emails}
            onChange={set("emails")}
            placeholder="Почта"
            addLabel="Ещё адрес"
            format={(v) => v.replace(/\s/g, "")}
            inputMode="email"
          />
          <ContactList
            icon={<AtSign className="size-4" />}
            values={draft.telegram}
            onChange={set("telegram")}
            placeholder="@ник в Telegram"
            addLabel="Ещё ник"
            format={maskTelegram}
          />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={FIELDS.budget} edited={edited("budget")}>
          <input {...text("budget")} className={INPUT} />
        </Field>
        <Field label={FIELDS.deadline} edited={edited("deadline")}>
          <input {...text("deadline")} className={INPUT} />
        </Field>
      </div>

      <Field label={FIELDS.missing} edited={edited("missing")} hint="по вопросу в строке">
        <textarea {...text("missing")} rows={3} className={`${AREA} min-h-20`} />
      </Field>

      <Field label={FIELDS.reply_draft} edited={edited("reply_draft")}>
        <textarea {...text("reply_draft")} rows={8} className={`${AREA} min-h-40`} />
        {draft.reply_draft && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-1.5"
            icon={copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
            onClick={copy}
          >
            Скопировать ответ
          </Button>
        )}
      </Field>

      {/* Сохранение прилипает к низу панели, когда есть несохранённые правки */}
      <div
        className={`sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 ${
          dirty ? "" : "hidden"
        }`}
      >
        <span className="mr-auto text-xs text-ink-3">Есть несохранённые правки</span>
        <Button onClick={() => setDraft(toDraft(triage))} disabled={saving}>
          Отменить
        </Button>
        <Button variant="primary" loading={saving} onClick={save}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}

export function LeadDrawer({
  id,
  initial,
  onClose,
  onChanged,
}: {
  id: string;
  /** Заявка с доски — панель показывает её сразу, пока грузится история */
  initial?: Lead;
  onClose: () => void;
  onChanged: (lead: Lead) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const titleId = useId();
  const {
    data: lead,
    error,
    mutate,
  } = useSWR<LeadDetail>(["lead", id], () => api.lead(id), {
    fallbackData: initial ? { ...initial, events: [] } : undefined,
    refreshInterval: (latest) => (latest && (latest.state === "queued" || latest.state === "running") ? 2000 : 0),
  });
  const [busy, setBusy] = useState(false);
  const pending = lead?.state === "queued" || lead?.state === "running";

  useEffect(() => {
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      // Escape внутри открытого окна подтверждения закрывает только его
      if (e.key === "Escape" && !document.querySelector("[role=alertdialog]")) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
    };
  }, [onClose]);

  function update(next: LeadDetail) {
    mutate(next, { revalidate: false });
    const { events, ...rest } = next;
    void events; // история нужна только панели, на доску уходит сама заявка
    onChanged(rest);
  }

  async function move(status: Column) {
    if (!lead || status === lead.status) return;
    setBusy(true);
    try {
      await api.moveLead(lead.id, status);
      update(await api.lead(lead.id));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function retriage() {
    if (!lead) return;
    if (
      lead.edited.length &&
      !(await confirm({
        title: "Разобрать заново?",
        description: "Ручные правки заменятся новым разбором нейросети.",
        confirmLabel: "Разобрать",
      }))
    )
      return;
    setBusy(true);
    try {
      update(await api.retriage(lead.id));
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  }

  const t = lead?.triage;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fade-in absolute inset-0 bg-ink/25" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="slide-from-right relative flex h-full w-full max-w-5xl flex-col bg-canvas shadow-[-30px_0_60px_-30px_rgba(20,20,20,.35)]"
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-semibold text-ink">
              {t?.contacts.name || (lead ? "Заявка без имени" : "Заявка")}
            </h2>
            {lead && (
              <p className="truncate text-xs text-ink-3">
                {CHANNELS[lead.channel]} · {formatDateTime(lead.created_at)}
              </p>
            )}
          </div>
          {lead && (
            <label className="flex items-center gap-2 text-xs text-ink-3 max-sm:order-last max-sm:w-full">
              <span className="sm:hidden">Колонка</span>
              <select
                value={lead.status}
                disabled={busy}
                onChange={(e) => move(e.target.value as Column)}
                className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-line-strong max-sm:flex-1"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          {error && !lead ? (
            <p className="p-6 text-sm text-ink-2">{error.message}</p>
          ) : !lead ? (
            <div className="space-y-3 p-5">
              <div className="skeleton h-40 rounded-xl" />
              <div className="skeleton h-64 rounded-xl" />
            </div>
          ) : (
            <div className="grid items-start gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="space-y-4">
                {lead.status === "spam" && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                    <AlertCircle className="size-4 shrink-0" />
                    <span className="mr-auto">Заявка в спаме</span>
                    <Button size="sm" icon={<Undo2 className="size-3.5" />} disabled={busy} onClick={() => move("new")}>
                      Не спам — вернуть
                    </Button>
                  </div>
                )}
                <Panel className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <SectionLabel className="">Исходный текст</SectionLabel>
                    <HighlightLegend />
                  </div>
                  <HighlightedText text={lead.text} highlights={lead.highlights} />
                </Panel>
                {lead.notes.length > 0 && (
                  <div className="rounded-xl bg-warn-soft px-4 py-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-warn">
                      <TriangleAlert className="size-3.5" />
                      Поправили за нейросетью
                    </p>
                    <ul className="space-y-0.5 text-sm text-ink-2">
                      {lead.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Panel className="p-4">
                  <SectionLabel>История</SectionLabel>
                  <ol className="mt-2 space-y-2.5">
                    {lead.events.map((e, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
                        <span className="min-w-0 flex-1 text-ink-2">{e.text}</span>
                        <span className="shrink-0 text-xs text-ink-3 tabular-nums">{formatDateTime(e.at)}</span>
                      </li>
                    ))}
                  </ol>
                </Panel>
              </div>

              <Panel className="p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2">
                  <p className="mr-auto text-sm font-semibold text-ink">Разбор</p>
                  {lead.state === "done" && lead.method && (
                    <span className="text-xs text-ink-3">
                      {lead.method === "rules"
                        ? "по правилам"
                        : (lead.elapsed_ms ?? 0) < 300
                          ? "мгновенно, из кеша"
                          : `нейросеть, ${formatSeconds(lead.elapsed_ms ?? 0)}`}
                    </span>
                  )}
                  {!pending && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<RefreshCw className="size-3.5" />}
                      disabled={busy}
                      onClick={retriage}
                    >
                      Разобрать заново
                    </Button>
                  )}
                </div>
                {pending ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-center">
                    <Loader2 className="size-6 animate-spin text-info" />
                    <p className="text-sm text-ink-2">Нейросеть разбирает заявку…</p>
                  </div>
                ) : lead.state === "error" || !t ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <AlertCircle className="size-6 text-danger" />
                    <p className="max-w-xs text-sm text-ink-2">{lead.error ?? "Не удалось разобрать заявку."}</p>
                  </div>
                ) : (
                  <TriageForm key={JSON.stringify(t)} lead={lead} triage={t} onSaved={update} />
                )}
              </Panel>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
