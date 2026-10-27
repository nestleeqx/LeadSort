import { Globe, Mail, Send } from "lucide-react";
import type { ReactNode } from "react";

type Item = { channel: "form" | "telegram" | "manual"; text: string; type: string; badge: string };

// Обрывки заявок из демо-набора: так выглядит входящий поток до разбора
const ITEMS: Item[] = [
  {
    channel: "telegram",
    text: "СРОЧНО!!! с утра не работает оплата…",
    type: "Поддержка",
    badge: "bg-warn-soft text-warn",
  },
  {
    channel: "form",
    text: "Сеть кофеен, нужен сайт с меню и заказом…",
    type: "Новый сайт",
    badge: "bg-accent-soft text-accent-ink",
  },
  {
    channel: "manual",
    text: "Выведем ваш сайт в ТОП-10 за 14 дней…",
    type: "Спам",
    badge: "bg-danger-soft text-danger",
  },
  { channel: "telegram", text: "подключить онлайн-оплату ЮKassa…", type: "Доработка", badge: "bg-info-soft text-info" },
  {
    channel: "form",
    text: "Сколько стоит лендинг и за сколько делаете?",
    type: "Вопрос",
    badge: "bg-sunken text-ink-2",
  },
  {
    channel: "form",
    text: "Сайт взломали, Яндекс пометил опасным…",
    type: "Поддержка",
    badge: "bg-warn-soft text-warn",
  },
  {
    channel: "manual",
    text: "Корпоративный сайт, интеграция с 1С…",
    type: "Новый сайт",
    badge: "bg-accent-soft text-accent-ink",
  },
  {
    channel: "telegram",
    text: "Заработок от 5000₽ в день без вложений…",
    type: "Спам",
    badge: "bg-danger-soft text-danger",
  },
];

const ICONS: Record<Item["channel"], ReactNode> = {
  form: <Globe className="size-3.5 text-accent" />,
  telegram: <Send className="size-3.5 text-[#229ED9]" />,
  manual: <Mail className="size-3.5 text-ink-2" />,
};

/** Лента входящих заявок: каждая уже с типом, который ей дала нейросеть. */
export function LeadTicker() {
  return (
    <div className="relative overflow-hidden border-y border-line bg-surface py-4" aria-hidden>
      {/* Края ленты растворяются в фоне */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-surface to-transparent" />
      <div className="marquee flex w-max gap-3">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            className="flex shrink-0 items-center gap-2.5 rounded-full border border-line bg-canvas py-1.5 pr-1.5 pl-2 text-sm text-ink-2"
          >
            <span className="grid size-6 place-items-center rounded-full bg-surface">{ICONS[item.channel]}</span>
            {item.text}
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.badge}`}>{item.type}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
