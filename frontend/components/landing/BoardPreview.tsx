"use client";

import { Globe, Loader2, Mail, Send } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Mini = {
  id: string;
  name: string;
  channel: "form" | "telegram" | "manual";
  type: string;
  badge: string;
  urgent?: boolean;
  pending?: boolean;
};

const ICONS: Record<Mini["channel"], ReactNode> = {
  form: <Globe className="size-3.5 text-accent" />,
  telegram: <Send className="size-3.5 text-[#229ED9]" />,
  manual: <Mail className="size-3.5 text-ink-2" />,
};

const NEW_SITE = "bg-accent-soft text-accent-ink";
const IMPROVE = "bg-info-soft text-info";
const SUPPORT = "bg-warn-soft text-warn";
const QUESTION = "bg-sunken text-ink-2";

const START: Record<"new" | "work" | "wait", Mini[]> = {
  new: [
    { id: "a", name: "Алина", channel: "form", type: "Новый сайт", badge: NEW_SITE },
    { id: "b", name: "Игорь", channel: "form", type: "Вопрос", badge: QUESTION },
  ],
  work: [
    { id: "c", name: "Елена Сергеевна", channel: "form", type: "Поддержка", badge: SUPPORT, urgent: true },
    { id: "d", name: "Марина", channel: "manual", type: "Доработка", badge: IMPROVE },
  ],
  wait: [{ id: "e", name: "Наталья", channel: "manual", type: "Новый сайт", badge: NEW_SITE }],
};

// Новые заявки, которые по кругу приходят на доску
const INCOMING: Omit<Mini, "id">[] = [
  { name: "Денис", channel: "telegram", type: "Поддержка", badge: SUPPORT, urgent: true },
  { name: "Оксана", channel: "form", type: "Новый сайт", badge: NEW_SITE },
  { name: "Кирилл", channel: "telegram", type: "Доработка", badge: IMPROVE },
];

const COLUMNS = [
  { id: "new", label: "Новая", dot: "bg-accent" },
  { id: "work", label: "В работе", dot: "bg-info" },
  { id: "wait", label: "Ждём клиента", dot: "bg-warn" },
] as const;

const MAX = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function MiniCard({ card }: { card: Mini }) {
  return (
    <div
      className={`pop rounded-xl border p-2.5 shadow-[0_1px_2px_rgba(21,23,28,.05)] ${
        card.pending
          ? "border-accent/25 bg-gradient-to-b from-accent-soft to-surface"
          : card.urgent
            ? "border-danger/20 bg-gradient-to-b from-danger-soft/70 to-surface"
            : "border-line bg-surface"
      }`}
    >
      {/* В узкой колонке на телефоне — значок без плитки и срочность точкой: так карточки одной высоты */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="grid shrink-0 place-items-center sm:size-7 sm:rounded-lg sm:border sm:border-line sm:bg-surface">
          {ICONS[card.channel]}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{card.name}</span>
        {card.urgent && !card.pending && (
          <span className="size-1.5 shrink-0 rounded-full bg-danger sm:hidden" title="Срочно" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {/* Пока идёт разбор, на месте типа — значок «Разбор»: в узкой колонке ему не место рядом с именем */}
        {card.pending ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Loader2 className="size-3 animate-spin" />
            Разбор
          </span>
        ) : (
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${card.badge}`}>{card.type}</span>
        )}
        {card.urgent && !card.pending && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap text-danger max-sm:hidden">
            <span className="size-1.5 rounded-full bg-danger" />
            Срочно
          </span>
        )}
      </div>
    </div>
  );
}

/** Мини-доска на лендинге: заявка приходит, разбирается и уезжает в работу — сама, по кругу. */
export function BoardPreview() {
  const [board, setBoard] = useState(START);

  useEffect(() => {
    // Карточки появляются на месте, без выезда, — это не мешает и при «уменьшить движение»
    let alive = true;
    (async () => {
      let n = 0;
      while (alive) {
        await sleep(1800);
        if (!alive) return;
        const card: Mini = { ...INCOMING[n % INCOMING.length], id: `in-${n}`, pending: true };
        n += 1;
        setBoard((b) => ({ ...b, new: [card, ...b.new].slice(0, MAX) }));
        await sleep(1500);
        if (!alive) return;
        setBoard((b) => ({ ...b, new: b.new.map((c) => (c.id === card.id ? { ...c, pending: false } : c)) }));
        await sleep(2000);
        if (!alive) return;
        setBoard((b) => ({
          ...b,
          new: b.new.filter((c) => c.id !== card.id),
          work: [{ ...card, pending: false }, ...b.work].slice(0, MAX),
        }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="rounded-3xl border border-line bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(21,23,28,.3)] sm:p-4"
      aria-label="Пример доски заявок"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
        {COLUMNS.map((col, i) => (
          <div key={col.id} className={`rounded-2xl bg-sunken/80 p-2 ${i === 2 ? "max-sm:hidden" : ""}`}>
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-ink">
              <span className={`size-1.5 rounded-full ${col.dot}`} />
              {col.label}
              <span className="ml-auto rounded-md bg-surface px-1.5 text-[10px] text-ink-2 tabular-nums">
                {board[col.id].length}
              </span>
            </p>
            <div className="flex min-h-[13.5rem] flex-col gap-2">
              {board[col.id].map((card) => (
                <MiniCard key={`${card.id}-${card.pending ? "p" : "d"}`} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
