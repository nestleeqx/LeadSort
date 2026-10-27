"use client";

import { AlertTriangle, Clock, Download, Inbox, PenLine, ShieldOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { CHANNELS, COLUMNS, TYPES, formatSeconds, plural } from "@/lib/labels";
import type { Stats } from "@/lib/types";
import { useToast } from "../Toast";
import { Button, Panel } from "../ui";

// Один цвет на все столбики: каждый график показывает одну величину, разные цвета не нужны.
// Проверен на контраст к белому фону (скрипт validate_palette из навыка dataviz)
const BAR = "bg-accent";
const MAX_BAR_PX = 24;

const percent = (share: number) => `${Math.round(share * 100)} %`;

function weekday(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return {
    short: date.toLocaleDateString("ru-RU", { weekday: "short" }),
    day: date.getDate(),
    long: date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }),
  };
}

const TONES = {
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  neutral: "bg-sunken text-ink-2",
};

function Tile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: keyof typeof TONES;
}) {
  return (
    // Плитка не растягивается под большое число: значение уменьшается на телефоне, подпись прижата к низу
    <Panel className="flex min-w-0 flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-ink-3">{label}</p>
        <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>{icon}</span>
      </div>
      <p
        className="mt-2 truncate text-2xl leading-tight font-semibold tracking-tight text-ink tabular-nums sm:text-[28px]"
        title={value}
      >
        {value}
      </p>
      {hint && <p className="mt-auto pt-2 text-xs text-ink-3">{hint}</p>}
    </Panel>
  );
}

/** Заявки по дням за неделю: столбики от общей базовой линии, подпись — только у максимума. */
function DaysChart({ days }: { days: Stats["by_day"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));
  const peak = days.findIndex((d) => d.total === max);
  const height = 160;

  return (
    <div>
      <div className="relative flex items-end gap-1 border-b border-line-strong" style={{ height }}>
        {days.map((d, i) => {
          const h = Math.max(d.total ? 4 : 0, Math.round((d.total / max) * (height - 24)));
          const info = weekday(d.date);
          return (
            <div
              key={d.date}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${info.long}: ${d.total} ${plural(d.total, ["заявка", "заявки", "заявок"])}, спам — ${d.spam}`}
            >
              {/* Подписываем только самый загруженный день, остальное — в подсказке */}
              {i === peak && d.total > 0 && (
                <span className="absolute text-xs font-medium text-ink tabular-nums" style={{ bottom: h + 4 }}>
                  {d.total}
                </span>
              )}
              <div
                className={`w-full rounded-t-[4px] transition-opacity ${BAR} ${hover !== null && hover !== i ? "opacity-40" : ""}`}
                style={{ height: h, maxWidth: MAX_BAR_PX }}
              />
              {hover === i && (
                <div
                  className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg ${
                    i === 0 ? "left-0" : i === days.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  <p className="font-medium text-ink first-letter:uppercase">{info.long}</p>
                  <p className="mt-0.5 text-ink-2 tabular-nums">
                    {d.total} {plural(d.total, ["заявка", "заявки", "заявок"])}
                    {d.spam > 0 && `, из них спам — ${d.spam}`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        {days.map((d) => {
          const info = weekday(d.date);
          return (
            <p key={d.date} className="flex-1 text-center text-[11px] leading-tight text-ink-3">
              {info.short}
              <br />
              <span className="tabular-nums">{info.day}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Горизонтальные столбики в фиксированном порядке категорий; число — отдельной колонкой, как в таблице. */
function BarList({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="group" title={`${r.label}: ${r.count} из ${total}`}>
            <td className="w-0 py-1.5 pr-3 whitespace-nowrap text-ink-2">{r.label}</td>
            <td className="w-full py-1.5">
              <div className="h-3 w-full">
                <div
                  className={`h-full rounded-r-[4px] ${BAR} group-hover:opacity-80`}
                  style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count ? 4 : 0, maxHeight: MAX_BAR_PX }}
                />
              </div>
            </td>
            <td className="w-0 py-1.5 pl-3 text-right whitespace-nowrap text-ink tabular-nums">{r.count}</td>
            <td className="w-0 py-1.5 pl-2 text-right whitespace-nowrap text-xs text-ink-3 tabular-nums">
              {total ? percent(r.count / total) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Panel className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Panel>
  );
}

export function StatsView() {
  const toast = useToast();
  const { data, error, mutate } = useSWR<Stats>("stats", api.stats);
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      await api.exportCsv();
    } catch (e) {
      toast.error(e);
    } finally {
      setExporting(false);
    }
  }

  const header = (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="mr-auto">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Статистика</h1>
        <p className="mt-1 text-sm text-ink-3">По заявкам на вашей доске, включая демо</p>
      </div>
      <Button icon={<Download className="size-4" />} loading={exporting} onClick={exportCsv} className="h-10">
        Экспорт в CSV
      </Button>
    </div>
  );

  if (error && !data) {
    return (
      <>
        {header}
        <Panel className="p-6 text-center">
          <p className="text-sm text-ink">{error.message}</p>
          <Button className="mt-3" onClick={() => mutate()}>
            Повторить
          </Button>
        </Panel>
      </>
    );
  }

  if (!data) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton mt-4 h-64 rounded-2xl" />
      </>
    );
  }

  const done = data.by_type.reduce((n, t) => n + t.count, 0);

  return (
    <>
      {header}
      {/* Пятая плитка на телефоне — во всю ширину, чтобы не висела одна в половине ряда */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 max-sm:[&>*:last-child]:col-span-2">
        <Tile
          icon={<Inbox className="size-4" />}
          tone="accent"
          label="За 7 дней"
          value={data.week_total.toLocaleString("ru-RU")}
          hint={`всего на доске ${data.total}`}
        />
        <Tile
          icon={<AlertTriangle className="size-4" />}
          tone="danger"
          label="Срочных в работе"
          value={data.urgent_open.toLocaleString("ru-RU")}
          hint="с уведомлением в Telegram"
        />
        <Tile
          icon={<ShieldOff className="size-4" />}
          tone="warn"
          label="Доля спама"
          value={percent(data.spam_share)}
          hint={`за неделю отсеяно ${data.week_spam}`}
        />
        <Tile
          icon={<Clock className="size-4" />}
          tone="info"
          label="Разбор нейросетью"
          value={data.avg_triage_ms ? formatSeconds(data.avg_triage_ms) : "—"}
          hint="в среднем на заявку"
        />
        <Tile
          icon={<PenLine className="size-4" />}
          tone="neutral"
          label="Поправлено вручную"
          value={percent(data.edited_share)}
          hint="менеджер изменил поля"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Заявки по дням" hint="За последние 7 дней — наведите на столбик, чтобы увидеть подробности">
          <DaysChart days={data.by_day} />
        </Section>
        <Section title="По типам" hint={`Все разобранные заявки — ${done}`}>
          <BarList rows={data.by_type.map((t) => ({ label: TYPES[t.key].label, count: t.count }))} total={done} />
        </Section>
        <Section title="По каналам" hint="Откуда пришли заявки">
          <BarList rows={data.by_channel.map((c) => ({ label: CHANNELS[c.key], count: c.count }))} total={data.total} />
        </Section>
        <Section title="По колонкам доски" hint="Где заявки сейчас">
          <BarList
            rows={data.by_status.map((s) => ({
              label: COLUMNS.find((c) => c.id === s.key)?.label ?? s.key,
              count: s.count,
            }))}
            total={data.total}
          />
        </Section>
      </div>
    </>
  );
}
