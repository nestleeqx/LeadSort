import type { LeadType, Urgency } from "./types";

export const TYPES: Record<LeadType, { label: string; badge: string }> = {
  new_site: { label: "Новый сайт", badge: "bg-accent-soft text-accent-ink" },
  improvement: { label: "Доработка", badge: "bg-info-soft text-info" },
  support: { label: "Поддержка", badge: "bg-warn-soft text-warn" },
  question: { label: "Вопрос", badge: "bg-sunken text-ink-2" },
  spam: { label: "Спам", badge: "bg-danger-soft text-danger" },
};

export const URGENCY: Record<Urgency, { label: string; dot: string; text: string }> = {
  high: { label: "Высокая срочность", dot: "bg-danger", text: "text-danger" },
  medium: { label: "Средняя срочность", dot: "bg-warn", text: "text-warn" },
  low: { label: "Низкая срочность", dot: "bg-ink-3", text: "text-ink-2" },
};

export const NOT_SPECIFIED = "не указано";

export function formatSeconds(ms: number) {
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
}
