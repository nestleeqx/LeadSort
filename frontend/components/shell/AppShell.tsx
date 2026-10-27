"use client";

import { ArrowUpRight, BarChart3, Globe, KanbanSquare, Menu, Search, Send, Sparkles, Wand2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { plural } from "@/lib/labels";
import type { Board } from "@/lib/types";
import { boardRefresh, isPending } from "../board/Board";
import { Logo } from "../Logo";
import { SearchProvider, useSearch } from "./search";
import { TelegramDialog, useTelegram } from "./TelegramDialog";

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  external?: boolean;
};

const NAV_ITEM = "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors";

/** Сводка доски для меню и плашки ИИ — тот же запрос, что у самой доски, SWR не дублирует его. */
function useBoardSummary() {
  const { data } = useSWR<Board>("board", api.board, { refreshInterval: boardRefresh });
  const leads = data?.leads ?? [];
  return {
    loaded: !!data,
    newCount: leads.filter((l) => l.status === "new").length,
    pending: leads.filter(isPending).length,
    urgent: leads.filter((l) => l.triage?.notify && l.status !== "closed" && l.status !== "spam").length,
  };
}

function NavItem({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = !item.external && pathname === item.href;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${NAV_ITEM} ${
        active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
      }`}
    >
      <span className={active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"}>{item.icon}</span>
      {item.label}
      {item.external && <ArrowUpRight className="ml-auto size-3.5 text-ink-3" />}
      {!!item.badge && (
        <span
          className={`ml-auto min-w-5 rounded-md px-1.5 py-px text-center text-[11px] font-semibold tabular-nums ${
            active ? "bg-accent text-white" : "bg-accent-soft text-accent-ink"
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

/** Пункт бота: открывает окно привязки; метка показывает, подключён ли чат к доске. */
function TelegramItem({ onOpen }: { onOpen: () => void }) {
  const { data } = useTelegram();
  const icon = <Send className="size-4" />;

  if (data && !data.enabled) {
    return (
      <span className={`${NAV_ITEM} cursor-default text-ink-3`} title="Бот не настроен на сервере">
        {icon}
        Telegram-бот
        <span className="ml-auto rounded-md bg-sunken px-1.5 py-px text-[10px] font-medium">выкл</span>
      </span>
    );
  }
  const linked = !!data?.chats.length;
  return (
    <button type="button" onClick={onOpen} className={`${NAV_ITEM} w-full text-ink-2 hover:bg-sunken hover:text-ink`}>
      <span className="text-ink-3 group-hover:text-ink-2">{icon}</span>
      Telegram-бот
      {data && (
        <span
          className={`ml-auto rounded-md px-1.5 py-px text-[10px] font-semibold ${
            linked ? "bg-success-soft text-success" : "bg-accent-soft text-accent-ink"
          }`}
        >
          {linked ? "подключён" : "подключить"}
        </span>
      )}
    </button>
  );
}

function Sidebar({ onNavigate, onTelegram }: { onNavigate?: () => void; onTelegram: () => void }) {
  const { newCount } = useBoardSummary();
  const work: Item[] = [
    { href: "/app", label: "Доска заявок", icon: <KanbanSquare className="size-4" />, badge: newCount },
    { href: "/app/stats", label: "Статистика", icon: <BarChart3 className="size-4" /> },
    { href: "/try", label: "Проверить разбор", icon: <Wand2 className="size-4" /> },
  ];
  const site: Item = { href: "/pixel", label: "Сайт студии", icon: <Globe className="size-4" />, external: true };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/" aria-label="LeadSort — на главную" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pt-2 scrollbar-thin">
        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-medium text-ink-3">Работа</p>
          <div className="space-y-0.5">
            {work.map((item) => (
              <NavItem key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 px-2.5 text-[11px] font-medium text-ink-3">Каналы заявок</p>
          <div className="space-y-0.5">
            <NavItem item={site} onNavigate={onNavigate} />
            <TelegramItem onOpen={onTelegram} />
          </div>
        </div>
      </nav>
      <div className="p-3">
        <div className="rounded-xl border border-line bg-gradient-to-b from-accent-soft/70 to-surface p-3.5">
          <p className="text-[13px] font-semibold text-ink">Демо: студия «Пиксель»</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            У каждого посетителя своя копия доски — правьте и перетаскивайте смело.
          </p>
          <Link
            href="/"
            onClick={onNavigate}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            О сервисе
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Тёмная плашка статуса: что сейчас делает нейросеть и сколько срочных ждут ответа. */
function AiStatus() {
  const { loaded, pending, urgent } = useBoardSummary();
  return (
    <Link
      href="/app"
      className="flex items-center gap-2.5 rounded-full bg-ink py-1.5 pr-3.5 pl-1.5 text-white shadow-[0_8px_20px_-10px_rgba(21,23,28,.6)] transition-colors hover:bg-ink/90"
      title="Состояние разбора заявок"
    >
      <span className="grid size-7 place-items-center rounded-full bg-white/10">
        <Sparkles className={`size-3.5 ${pending ? "animate-pulse text-glow" : "text-white"}`} />
      </span>
      <span className="leading-tight">
        <span className="flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap">
          {/* На самых узких экранах — только значок и статус, иначе подпись переносится */}
          <span className="max-[379px]:hidden">ИИ-разбор</span>
          <span
            className={`rounded-md px-1.5 py-px text-[10px] font-semibold ${
              pending ? "bg-glow text-accent-ink" : "bg-success/90 text-white"
            }`}
          >
            {!loaded ? "…" : pending ? `${pending} в работе` : "готов"}
          </span>
        </span>
        <span className="block text-[11px] text-white/60 max-sm:hidden">
          {loaded && urgent
            ? `${urgent} ${plural(urgent, ["срочная ждёт", "срочные ждут", "срочных ждут"])} ответа`
            : "срочных нет"}
        </span>
      </span>
    </Link>
  );
}

function TopSearch() {
  const { q, setQ } = useSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  // «/» с любого места страницы — к поиску, как в привычных сервисах
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || target.closest("input, textarea, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Имя, телефон или текст заявки"
        aria-label="Поиск по заявкам"
        className={`h-10 w-full rounded-xl border border-line bg-surface pl-9 text-sm ${q ? "pr-10" : "pr-3 sm:pr-10"} outline-none placeholder:text-ink-3 focus:border-accent/40 focus:ring-4 focus:ring-accent-soft`}
      />
      {q ? (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Очистить поиск"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md border border-line bg-sunken px-1.5 text-[11px] text-ink-3 max-sm:hidden">
          /
        </kbd>
      )}
    </form>
  );
}

/** Чья это доска: демо открыто от лица веб-студии «Пиксель». */
function StudioBadge() {
  return (
    <span className="flex items-center gap-2.5 max-sm:hidden" title="Демо открыто от лица веб-студии «Пиксель»">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ff9a7a] to-[#ff6b4a] text-sm font-semibold text-white">
        П
      </span>
      <span className="leading-tight max-xl:hidden">
        <span className="block text-[13px] font-medium whitespace-nowrap text-ink">Студия «Пиксель»</span>
        <span className="block text-[11px] text-ink-3">демо-доступ</span>
      </span>
    </span>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const closeTelegram = useCallback(() => setTelegramOpen(false), []);
  const onBoard = usePathname() === "/app";

  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-full lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <Sidebar onTelegram={() => setTelegramOpen(true)} />
      </aside>
      {telegramOpen && <TelegramDialog onClose={closeTelegram} />}

      {/* На телефоне и планшете меню выезжает справа по кнопке */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fade-in absolute inset-0 bg-ink/30" onClick={() => setMenuOpen(false)} />
          <aside
            className="slide-from-right absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-surface shadow-xl"
            aria-label="Меню"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Закрыть меню"
              className="absolute top-3.5 right-3 grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
            >
              <X className="size-4.5" />
            </button>
            <Sidebar
              onNavigate={() => setMenuOpen(false)}
              onTelegram={() => {
                setMenuOpen(false);
                setTelegramOpen(true);
              }}
            />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="LeadSort — на главную" className="lg:hidden">
            <Logo />
          </Link>
          {/* Поиск ищет заявки — он нужен только на доске */}
          {onBoard && (
            <div className="hidden max-w-md flex-1 md:block">
              <TopSearch />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            <AiStatus />
            <StudioBadge />
            {/* Меню на телефоне — справа, под большой палец; выезжает с той же стороны */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Открыть меню"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 lg:hidden"
            >
              <Menu className="size-4.5" />
            </button>
          </div>
        </div>
        {/* На узком экране поиск — отдельной строкой под панелью, на доске он нужнее всего */}
        {onBoard && (
          <div className="px-4 pb-3 md:hidden">
            <TopSearch />
          </div>
        )}
      </header>

      <main>{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SearchProvider>
      <Shell>{children}</Shell>
    </SearchProvider>
  );
}
