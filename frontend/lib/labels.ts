import type { Channel, Column, LeadType, TriageField, Urgency } from "./types";

export const TYPES: Record<LeadType, { label: string; badge: string }> = {
  new_site: { label: "Новый сайт", badge: "bg-accent-soft text-accent-ink" },
  improvement: { label: "Доработка", badge: "bg-info-soft text-info" },
  support: { label: "Поддержка", badge: "bg-warn-soft text-warn" },
  question: { label: "Вопрос", badge: "bg-sunken text-ink-2" },
  spam: { label: "Спам", badge: "bg-danger-soft text-danger" },
};

export const URGENCY: Record<Urgency, { label: string; short: string; dot: string; text: string }> = {
  high: { label: "Высокая срочность", short: "Срочно", dot: "bg-danger", text: "text-danger" },
  medium: { label: "Средняя срочность", short: "Средняя", dot: "bg-warn", text: "text-warn" },
  low: { label: "Низкая срочность", short: "Не срочно", dot: "bg-ink-3", text: "text-ink-2" },
};

export const COLUMNS: { id: Column; label: string; dot: string }[] = [
  { id: "new", label: "Новая", dot: "bg-accent" },
  { id: "in_progress", label: "В работе", dot: "bg-info" },
  { id: "waiting", label: "Ждём клиента", dot: "bg-warn" },
  { id: "closed", label: "Закрыта", dot: "bg-ink-3" },
  { id: "spam", label: "Спам", dot: "bg-danger" },
];

export const CHANNELS: Record<Channel, string> = {
  form: "Форма на сайте",
  telegram: "Telegram",
  manual: "Добавлена вручную",
};

export const FIELDS: Record<TriageField, string> = {
  type: "Тип",
  urgency: "Срочность",
  urgency_reason: "Причина срочности",
  contacts: "Контакты",
  budget: "Бюджет",
  deadline: "Сроки",
  summary: "Резюме",
  missing: "Чего не хватает",
  reply_draft: "Черновик ответа",
};

export const NOT_SPECIFIED = "не указано";

export function formatSeconds(ms: number) {
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} с`;
}

export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** «только что», «5 мин назад», «3 ч назад», «вчера», «4 дня назад». */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days === 1) return "вчера";
  return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
