"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight, Download, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { CHANNELS, COLUMNS, TYPES, URGENCY, plural } from "@/lib/labels";
import { PAGE } from "@/lib/layout";
import type { Board as BoardData, Channel, Column, Lead, LeadType, Urgency } from "@/lib/types";
import { useConfirm } from "../Confirm";
import { useSearch } from "../shell/search";
import { useToast } from "../Toast";
import { Button } from "../ui";
import { AddLeadDialog } from "./AddLeadDialog";
import { DraggedLeadCard, SortableLeadCard } from "./LeadCard";
import { LeadDrawer } from "./LeadDrawer";

type Items = Record<Column, string[]>;
type Filters = { q: string; types: LeadType[]; urgency: Urgency[]; channels: Channel[] };

const EMPTY_FILTERS: Filters = { q: "", types: [], urgency: [], channels: [] };
const COLUMN_IDS = COLUMNS.map((c) => c.id);

export const isPending = (lead: Lead) => lead.state === "queued" || lead.state === "running";

// Функция опроса — вне компонента: новая функция на каждой отрисовке перезапускает таймер SWR
export const boardRefresh = (latest?: BoardData) => (latest?.leads.some(isPending) ? 2000 : 15000);

function matches(lead: Lead, f: Filters) {
  const t = lead.triage;
  if (f.types.length && (!t || !f.types.includes(t.type))) return false;
  if (f.urgency.length && (!t || !f.urgency.includes(t.urgency))) return false;
  if (f.channels.length && !f.channels.includes(lead.channel)) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const c = t?.contacts;
    const haystack = [
      lead.text,
      t?.summary,
      c?.name,
      ...(c?.phones ?? []),
      ...(c?.emails ?? []),
      ...(c?.telegram ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

// Часы для «5 мин назад»: в браузере обновляются раз в минуту, при пререндере — ноль,
// иначе Next.js не может собрать страницу статически
let clock = 0;

function subscribeClock(onChange: () => void) {
  clock = Date.now();
  onChange();
  const timer = setInterval(() => {
    clock = Date.now();
    onChange();
  }, 60_000);
  return () => clearInterval(timer);
}

function useNow() {
  return useSyncExternalStore(
    subscribeClock,
    () => clock,
    () => 0,
  );
}

const noSubscribe = () => () => {};
const readLeadParam = () => new URLSearchParams(window.location.search).get("lead");

/** Позиция между соседями: так переносится одна карточка, а не вся колонка. */
function positionAt(ids: string[], index: number, byId: Map<string, Lead>) {
  const prev = ids[index - 1] ? byId.get(ids[index - 1])?.position : undefined;
  const next = ids[index + 1] ? byId.get(ids[index + 1])?.position : undefined;
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1;
  if (next !== undefined) return next - 1;
  return 0;
}

const TYPE_ORDER: LeadType[] = ["new_site", "improvement", "support", "question", "spam"];

/** Таблетка типа со счётчиком — как «All 11 · Emails 3» в референсе. Активная — тёмная. */
function TypePill({
  label,
  count,
  countClass,
  active,
  onClick,
}: {
  label: string;
  count: number;
  countClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border pr-1.5 pl-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums ${
          active ? "bg-success text-white" : countClass
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Срочность и канал — во всплывающей панели, чтобы строка фильтров не разрасталась. */
function MoreFilters({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = filters.urgency.length + filters.channels.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${
          active
            ? "border-accent/40 bg-accent-soft text-accent-ink"
            : "border-line bg-surface text-ink-2 hover:text-ink"
        }`}
      >
        <SlidersHorizontal className="size-4" />
        Фильтры
        {active > 0 && (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{active}</span>
        )}
      </button>
      {open && (
        <div className="pop absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_48px_-20px_rgba(21,23,28,.35)] max-sm:left-0 max-sm:right-auto">
          <p className="mb-2 text-xs font-medium text-ink-3">Срочность</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(URGENCY) as Urgency[]).map((u) => (
              <FilterChip
                key={u}
                active={filters.urgency.includes(u)}
                onClick={() => onChange({ ...filters, urgency: toggle(filters.urgency, u) })}
              >
                <span className={`size-1.5 rounded-full ${URGENCY[u].dot}`} />
                {URGENCY[u].short}
              </FilterChip>
            ))}
          </div>
          <p className="mt-4 mb-2 text-xs font-medium text-ink-3">Канал</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CHANNELS) as Channel[]).map((c) => (
              <FilterChip
                key={c}
                active={filters.channels.includes(c)}
                onClick={() => onChange({ ...filters, channels: toggle(filters.channels, c) })}
              >
                {CHANNELS[c]}
              </FilterChip>
            ))}
          </div>
          {active > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, urgency: [], channels: [] })}
              className="mt-4 text-xs font-medium text-accent hover:underline"
            >
              Сбросить срочность и канал
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function ColumnView({
  column,
  ids,
  byId,
  now,
  fresh,
  onOpen,
  total,
  filtered,
  highlighted,
  mobileActive,
  collapsed,
  onToggleCollapsed,
}: {
  column: (typeof COLUMNS)[number];
  ids: string[];
  byId: Map<string, Lead>;
  now: number;
  fresh: Set<string>;
  onOpen: (id: string) => void;
  total: number;
  filtered: boolean;
  /** Сюда сейчас перетаскивают карточку из другой колонки */
  highlighted: boolean;
  /** На телефоне видна только колонка, выбранная во вкладках */
  mobileActive: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { setNodeRef, isOver: overColumn } = useDroppable({ id: column.id });
  const isOver = overColumn || highlighted;

  // Свёрнутый спам — узкая полоса на широком экране; на телефоне колонки и так по одной
  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onToggleCollapsed}
        title="Показать спам"
        className={`hidden w-12 shrink-0 flex-col items-center gap-3 self-stretch rounded-2xl border border-dashed py-4 text-xs transition-colors md:flex ${
          isOver ? "border-danger bg-danger-soft" : "border-line-strong bg-surface/60 text-ink-2 hover:bg-surface"
        }`}
      >
        <ChevronLeft className="size-4 text-ink-3" />
        <span className={`size-2 rounded-full ${column.dot}`} />
        <span className="font-medium [writing-mode:vertical-rl]">
          {column.label} · {total}
        </span>
      </button>
    );
  }

  return (
    <section
      className={`w-full shrink-0 flex-col rounded-2xl p-2 transition-colors md:w-[300px] ${
        mobileActive ? "flex" : "hidden md:flex"
      } ${
        // Обводка внутри колонки: снаружи её верх срезает контейнер с горизонтальной прокруткой
        isOver ? "bg-accent-soft ring-2 ring-accent/30 ring-inset" : column.id === "spam" ? "bg-danger-soft/40" : "bg-sunken/80"
      }`}
      aria-label={column.label}
    >
      {/* На телефоне название и счётчик уже на вкладке — заголовок колонки не повторяем */}
      <header className="hidden h-9 items-center gap-2 px-2 md:flex">
        <span className={`size-2 rounded-full ${column.dot}`} />
        <h2 className="text-sm font-semibold text-ink">{column.label}</h2>
        <span className="rounded-md bg-surface px-1.5 py-px text-[11px] font-semibold text-ink-2 tabular-nums shadow-[0_1px_2px_rgba(21,23,28,.06)]">
          {filtered ? `${ids.length} из ${total}` : ids.length}
        </span>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Свернуть"
            className="ml-auto hidden size-7 place-items-center rounded-md text-ink-3 hover:bg-surface hover:text-ink md:grid"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </header>
      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2 md:pt-1">
          {ids.map((id) => {
            const lead = byId.get(id);
            return lead ? (
              <SortableLeadCard key={id} lead={lead} now={now} fresh={fresh.has(id)} onOpen={onOpen} />
            ) : null;
          })}
          {ids.length === 0 && (
            <p className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-line-strong px-3 py-8 text-center text-xs text-ink-3">
              {filtered && total ? "Нет заявок под фильтр" : "Перетащите сюда заявку"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function Board() {
  const toast = useToast();
  const confirm = useConfirm();
  const now = useNow();
  const { data, error, mutate } = useSWR<BoardData>("board", api.board, {
    // Пока заявки разбираются — чаще, чтобы карточка обновилась сразу после разбора
    refreshInterval: boardRefresh,
  });
  // Заявка из ссылки ?lead=… (кнопки в Telegram). Читаем адрес напрямую: запрос доски
  // общий с боковым меню, и обработчик загрузки здесь может не вызваться
  const linkedLead = useSyncExternalStore(noSubscribe, readLeadParam, () => null);
  const [linkUsed, setLinkUsed] = useState(false);

  const [panelFilters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Строка поиска — в верхней панели приложения, остальные фильтры — на доске
  const { q, setQ } = useSearch();
  const filters = useMemo(() => ({ ...panelFilters, q }), [panelFilters, q]);
  const [spamOpen, setSpamOpen] = useState(false);
  const [mobileColumn, setMobileColumn] = useState<Column>("new");
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: Column | null } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const currentId = openId ?? (linkUsed ? null : linkedLead);
  const open = useCallback((id: string | null) => {
    setOpenId(id);
    setLinkUsed(true);
    const url = id ? `?lead=${id}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);

  // Карточка, которую только что разобрали, коротко подсвечивается
  useEffect(() => {
    const done = leads.filter((l) => pendingRef.current.has(l.id) && !isPending(l)).map((l) => l.id);
    pendingRef.current = new Set(leads.filter(isPending).map((l) => l.id));
    if (!done.length) return;
    setFresh((s) => new Set([...s, ...done]));
    const timer = setTimeout(() => setFresh((s) => new Set([...s].filter((id) => !done.includes(id)))), 1800);
    return () => clearTimeout(timer);
  }, [leads]);

  const totals = useMemo(() => {
    const out = Object.fromEntries(COLUMN_IDS.map((c) => [c, 0])) as Record<Column, number>;
    for (const l of leads) out[l.status] += 1;
    return out;
  }, [leads]);

  const baseItems = useMemo(() => {
    const out = Object.fromEntries(COLUMN_IDS.map((c) => [c, [] as Lead[]])) as Record<Column, Lead[]>;
    for (const l of leads) if (matches(l, filters)) out[l.status].push(l);
    return Object.fromEntries(
      COLUMN_IDS.map((c) => [c, out[c].sort((a, b) => a.position - b.position).map((l) => l.id)]),
    ) as Items;
  }, [leads, filters]);

  const items = baseItems;
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setQ("");
  };
  const shown = COLUMN_IDS.reduce((n, c) => n + baseItems[c].length, 0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // На телефоне карточку берут долгим нажатием, чтобы доска прокручивалась пальцем
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string, source: Items): Column | undefined =>
    (COLUMN_IDS as string[]).includes(id) ? (id as Column) : COLUMN_IDS.find((c) => source[c].includes(id));

  // Во время перетаскивания карточка между колонками не перекладывается — только подсвечивается
  // колонка под курсором. Перекладка на каждое движение мыши зацикливалась на границе колонок
  // (карточка прыгала туда-обратно) и роняла страницу.
  function onDragStart(e: DragStartEvent) {
    setDrag({ id: String(e.active.id), over: null });
  }

  function onDragOver({ over }: DragOverEvent) {
    const to = over ? (findColumn(String(over.id), baseItems) ?? null) : null;
    setDrag((d) => (d && d.over !== to ? { ...d, over: to } : d));
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setDrag(null);
    if (!over) return;
    const id = String(active.id);
    const to = findColumn(String(over.id), baseItems);
    const lead = byId.get(id);
    if (!to || !lead) return;

    let ids: string[];
    if (to === lead.status) {
      ids = baseItems[to];
      const overIndex = ids.indexOf(String(over.id));
      if (overIndex < 0 || overIndex === ids.indexOf(id)) return;
      ids = arrayMove(ids, ids.indexOf(id), overIndex);
    } else {
      // В чужую колонку: на место карточки под курсором или в конец, если отпустили на пустом месте
      const target = baseItems[to].filter((other) => other !== id);
      const overIndex = target.indexOf(String(over.id));
      const at = overIndex >= 0 ? overIndex : target.length;
      ids = [...target.slice(0, at), id, ...target.slice(at)];
    }
    const index = ids.indexOf(id);

    const position = positionAt(ids, index, byId);
    const optimistic = { leads: leads.map((l) => (l.id === id ? { ...l, status: to, position } : l)) };
    try {
      await mutate(
        async () => {
          const saved = await api.moveLead(id, to, position);
          return { leads: leads.map((l) => (l.id === id ? saved : l)) };
        },
        { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
      );
    } catch (e) {
      toast.error(e);
    }
  }

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

  async function resetDemo() {
    const ok = await confirm({
      title: "Сбросить демо?",
      description: "Доска вернётся к исходным 25 заявкам студии «Пиксель». Добавленные заявки и правки пропадут.",
      confirmLabel: "Сбросить",
      tone: "danger",
    });
    if (!ok) return;
    setResetting(true);
    try {
      await mutate(api.resetDemo(), { revalidate: false });
      resetFilters();
      open(null);
      toast.ok("Демо сброшено");
    } catch (e) {
      toast.error(e);
    } finally {
      setResetting(false);
    }
  }

  const dragged = drag ? byId.get(drag.id) : undefined;
  const urgentCount = leads.filter((l) => l.triage?.notify && l.status !== "closed" && l.status !== "spam").length;
  const activeType = panelFilters.types[0] ?? null;
  const typeCounts = useMemo(() => {
    const out = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0])) as Record<LeadType, number>;
    for (const l of leads) if (l.triage) out[l.triage.type] += 1;
    return out;
  }, [leads]);

  function pickType(type: LeadType | null) {
    setFilters({ ...panelFilters, types: type && type !== activeType ? [type] : [] });
    // Спам живёт в своей колонке: выбрали его — показываем эту колонку
    if (type === "spam" && type !== activeType) {
      setSpamOpen(true);
      setMobileColumn("spam");
    }
  }

  return (
    <div className={`${PAGE} py-5 sm:py-7`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* На телефоне заголовок — отдельной строкой, кнопки — строкой под ним */}
        <div className="mr-auto min-w-0 max-sm:w-full">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Доска заявок</h1>
          <p className="mt-1 text-sm text-ink-3">
            {data
              ? `${leads.length} ${plural(leads.length, ["заявка", "заявки", "заявок"])} · ${
                  urgentCount
                    ? `${urgentCount} ${plural(urgentCount, ["срочная", "срочные", "срочных"])} в работе`
                    : "срочных нет"
                }`
              : "Загружаем доску…"}
          </p>
        </div>
        <Button
          variant="ghost"
          icon={<RotateCcw className="size-4" />}
          loading={resetting}
          onClick={resetDemo}
          title="Сбросить демо"
          aria-label="Сбросить демо"
          className="h-10 rounded-xl max-sm:order-last"
        >
          <span className="max-sm:hidden">Сбросить демо</span>
        </Button>
        <Button
          icon={<Download className="size-4" />}
          loading={exporting}
          onClick={exportCsv}
          title="Скачать все заявки в CSV"
          aria-label="Экспорт в CSV"
          className="h-10 rounded-xl max-sm:order-last"
        >
          {/* На телефоне — только иконка, чтобы три кнопки встали в один ряд */}
          <span className="max-sm:hidden">Экспорт в CSV</span>
        </Button>
        <Button
          variant="primary"
          icon={<Plus className="size-4" />}
          onClick={() => setAdding(true)}
          className="h-10 rounded-xl px-4 max-sm:flex-1"
        >
          Добавить заявку
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* На телефоне таблетки — одной прокручиваемой строкой */}
        <div className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 scrollbar-none max-sm:basis-full sm:mx-0 sm:flex-wrap sm:px-0">
          <TypePill
            label="Все"
            count={leads.length}
            countClass="bg-sunken text-ink-2"
            active={!activeType}
            onClick={() => pickType(null)}
          />
          {TYPE_ORDER.map((t) => (
            <TypePill
              key={t}
              label={TYPES[t].label}
              count={typeCounts[t]}
              countClass={TYPES[t].badge}
              active={activeType === t}
              onClick={() => pickType(t)}
            />
          ))}
        </div>
        <MoreFilters filters={panelFilters} onChange={setFilters} />
        {filtered && (
          <span className="flex items-center gap-2 text-xs text-ink-3">
            Показано {shown} из {leads.length}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-accent hover:bg-accent-soft"
            >
              <X className="size-3.5" />
              Сбросить
            </button>
          </span>
        )}
      </div>

      {error && !data ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink">{error.message}</p>
          <Button className="mt-3" onClick={() => mutate()}>
            Повторить
          </Button>
        </div>
      ) : !data ? (
        <div className="flex gap-3 overflow-hidden">
          {COLUMNS.slice(0, 4).map((c, i) => (
            <div
              key={c.id}
              className={`w-full shrink-0 space-y-2 rounded-2xl bg-sunken/80 p-2 md:w-[300px] ${i ? "max-md:hidden" : ""}`}
            >
              <div className="skeleton h-7 w-28 rounded-lg" />
              <div className="skeleton h-32 rounded-2xl" />
              <div className="skeleton h-32 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* На телефоне колонки — вкладками: одна колонка на весь экран вместо прокрутки вбок */}
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 scrollbar-none md:hidden" role="tablist">
            {COLUMNS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={mobileColumn === c.id}
                onClick={() => setMobileColumn(c.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap ${
                  mobileColumn === c.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2"
                }`}
              >
                <span className={`size-1.5 rounded-full ${c.dot}`} />
                {c.label}
                <span className={`text-xs tabular-nums ${mobileColumn === c.id ? "text-white/70" : "text-ink-3"}`}>
                  {items[c.id].length}
                </span>
              </button>
            ))}
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDrag(null)}
          >
            <div className="flex items-start gap-3 md:-mx-6 md:overflow-x-auto md:px-6 md:pb-4 scrollbar-thin">
              {COLUMNS.map((column) => (
                <ColumnView
                  key={column.id}
                  column={column}
                  ids={items[column.id]}
                  byId={byId}
                  now={now}
                  fresh={fresh}
                  onOpen={open}
                  total={totals[column.id]}
                  filtered={filtered}
                  highlighted={!!drag && drag.over === column.id && byId.get(drag.id)?.status !== column.id}
                  mobileActive={mobileColumn === column.id}
                  collapsed={column.id === "spam" && !spamOpen && mobileColumn !== "spam"}
                  onToggleCollapsed={column.id === "spam" ? () => setSpamOpen((v) => !v) : undefined}
                />
              ))}
            </div>
            {/* Без анимации возврата: карточка сразу встаёт на новое место */}
            <DragOverlay dropAnimation={null}>
              {dragged ? <DraggedLeadCard lead={dragged} now={now} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {adding && (
        <AddLeadDialog
          onClose={() => setAdding(false)}
          onAdded={(lead) => {
            setAdding(false);
            pendingRef.current.add(lead.id);
            mutate({ leads: [lead, ...leads] }, { revalidate: true });
          }}
        />
      )}
      {currentId && (
        <LeadDrawer
          id={currentId}
          initial={byId.get(currentId)}
          onClose={() => open(null)}
          onChanged={(lead) =>
            mutate({ leads: leads.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)) }, { revalidate: false })
          }
        />
      )}
    </div>
  );
}
