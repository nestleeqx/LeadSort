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
import { ChevronLeft, ChevronRight, Download, Plus, RotateCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { CHANNELS, COLUMNS, TYPES, URGENCY, plural } from "@/lib/labels";
import { PAGE } from "@/lib/layout";
import type { Board as BoardData, Channel, Column, Lead, LeadType, Urgency } from "@/lib/types";
import { useConfirm } from "../Confirm";
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
const boardRefresh = (latest?: BoardData) => (latest?.leads.some(isPending) ? 2000 : 15000);

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

/** Позиция между соседями: так переносится одна карточка, а не вся колонка. */
function positionAt(ids: string[], index: number, byId: Map<string, Lead>) {
  const prev = ids[index - 1] ? byId.get(ids[index - 1])?.position : undefined;
  const next = ids[index + 1] ? byId.get(ids[index + 1])?.position : undefined;
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1;
  if (next !== undefined) return next - 1;
  return 0;
}

function Chip<T extends string>({
  value,
  active,
  onToggle,
  children,
}: {
  value: T;
  active: boolean;
  onToggle: (value: T) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onToggle(value)}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
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
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { setNodeRef, isOver: overColumn } = useDroppable({ id: column.id });
  const isOver = overColumn || highlighted;

  if (collapsed) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onToggleCollapsed}
        title="Показать спам"
        className={`flex w-11 shrink-0 snap-start flex-col items-center gap-3 rounded-xl border border-dashed py-3 text-xs transition-colors ${
          isOver ? "border-danger bg-danger-soft" : "border-line-strong bg-sunken/50 text-ink-2 hover:bg-sunken"
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
    <section className="flex w-[82vw] max-w-80 shrink-0 snap-start flex-col sm:w-72" aria-label={column.label}>
      <header className="mb-2 flex h-7 items-center gap-2 px-1">
        <span className={`size-2 rounded-full ${column.dot}`} />
        <h2 className="text-sm font-semibold text-ink">{column.label}</h2>
        <span className="text-xs text-ink-3 tabular-nums">{filtered ? `${ids.length} из ${total}` : ids.length}</span>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Свернуть"
            className="ml-auto grid size-7 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
          >
            <ChevronRight className="size-4" />
          </button>
        )}
      </header>
      <SortableContext id={column.id} items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-28 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors ${
            isOver ? "bg-accent-soft" : column.id === "spam" ? "bg-danger-soft/50" : "bg-sunken/70"
          }`}
        >
          {ids.map((id) => {
            const lead = byId.get(id);
            return lead ? (
              <SortableLeadCard key={id} lead={lead} now={now} fresh={fresh.has(id)} onOpen={onOpen} />
            ) : null;
          })}
          {ids.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-ink-3">
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
  const linkChecked = useRef(false);
  const { data, error, mutate } = useSWR<BoardData>("board", api.board, {
    // Пока заявки разбираются — чаще, чтобы карточка обновилась сразу после разбора
    refreshInterval: boardRefresh,
    onSuccess: () => {
      // Заявку из ссылки ?lead=… открываем, как только загрузилась доска (ссылки из Telegram)
      if (linkChecked.current) return;
      linkChecked.current = true;
      const id = new URLSearchParams(window.location.search).get("lead");
      if (id) setOpenId(id);
    },
  });

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [spamOpen, setSpamOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: Column | null } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const open = useCallback((id: string | null) => {
    setOpenId(id);
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
      setFilters(EMPTY_FILTERS);
      open(null);
      toast.ok("Демо сброшено");
    } catch (e) {
      toast.error(e);
    } finally {
      setResetting(false);
    }
  }

  const dragged = drag ? byId.get(drag.id) : undefined;
  const urgentCount = leads.filter((l) => l.triage?.notify && l.status !== "closed").length;

  return (
    <div className={`${PAGE} py-5 sm:py-6`}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {/* На телефоне заголовок — отдельной строкой, кнопки — строкой под ним */}
        <div className="mr-auto min-w-0 max-sm:w-full">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">Заявки</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {data
              ? `${leads.length} ${plural(leads.length, ["заявка", "заявки", "заявок"])} · срочных в работе: ${urgentCount}`
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
          className="max-sm:order-last"
        >
          <span className="max-sm:hidden">Сбросить демо</span>
        </Button>
        <Button
          icon={<Download className="size-4" />}
          loading={exporting}
          onClick={exportCsv}
          title="Скачать все заявки в CSV"
          aria-label="Экспорт в CSV"
          className="max-sm:order-last"
        >
          {/* На телефоне — только иконка, чтобы три кнопки встали в один ряд */}
          <span className="max-sm:hidden">Экспорт в CSV</span>
        </Button>
        <Button
          variant="primary"
          icon={<Plus className="size-4" />}
          onClick={() => setAdding(true)}
          className="max-sm:flex-1"
        >
          Добавить заявку
        </Button>
      </div>

      <div className="mb-4 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Поиск по тексту, имени, телефону"
              className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-line-strong"
            />
          </label>
          {filtered && (
            <span className="flex items-center gap-2 text-xs text-ink-3">
              Показано {shown} из {leads.length}
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-2 hover:bg-sunken hover:text-ink"
              >
                <X className="size-3.5" />
                Сбросить фильтры
              </button>
            </span>
          )}
        </div>
        {/* На телефоне фильтры — одной прокручиваемой строкой */}
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-thin sm:mx-0 sm:flex-wrap sm:px-0">
          {(Object.keys(TYPES) as LeadType[])
            .filter((t) => t !== "spam")
            .map((t) => (
              <Chip
                key={t}
                value={t}
                active={filters.types.includes(t)}
                onToggle={(v) => setFilters({ ...filters, types: toggle(filters.types, v) })}
              >
                {TYPES[t].label}
              </Chip>
            ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          {(Object.keys(URGENCY) as Urgency[]).map((u) => (
            <Chip
              key={u}
              value={u}
              active={filters.urgency.includes(u)}
              onToggle={(v) => setFilters({ ...filters, urgency: toggle(filters.urgency, v) })}
            >
              <span className={`size-1.5 rounded-full ${URGENCY[u].dot}`} />
              {URGENCY[u].short}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          {(Object.keys(CHANNELS) as Channel[]).map((c) => (
            <Chip
              key={c}
              value={c}
              active={filters.channels.includes(c)}
              onToggle={(v) => setFilters({ ...filters, channels: toggle(filters.channels, v) })}
            >
              {CHANNELS[c]}
            </Chip>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-sm text-ink">{error.message}</p>
          <Button className="mt-3" onClick={() => mutate()}>
            Повторить
          </Button>
        </div>
      ) : !data ? (
        <div className="flex gap-3 overflow-hidden">
          {COLUMNS.slice(0, 4).map((c) => (
            <div key={c.id} className="w-[82vw] max-w-80 shrink-0 space-y-2 sm:w-72">
              <div className="skeleton h-6 w-28 rounded" />
              <div className="skeleton h-28 rounded-xl" />
              <div className="skeleton h-28 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 scrollbar-thin sm:-mx-6 sm:snap-none sm:px-6">
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
                collapsed={column.id === "spam" && !spamOpen}
                onToggleCollapsed={column.id === "spam" ? () => setSpamOpen((v) => !v) : undefined}
              />
            ))}
          </div>
          {/* Без анимации возврата: карточка сразу встаёт на новое место */}
          <DragOverlay dropAnimation={null}>
            {dragged ? <DraggedLeadCard lead={dragged} now={now} /> : null}
          </DragOverlay>
        </DndContext>
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
      {openId && (
        <LeadDrawer
          id={openId}
          initial={byId.get(openId)}
          onClose={() => open(null)}
          onChanged={(lead) =>
            mutate({ leads: leads.map((l) => (l.id === lead.id ? { ...l, ...lead } : l)) }, { revalidate: false })
          }
        />
      )}
    </div>
  );
}
