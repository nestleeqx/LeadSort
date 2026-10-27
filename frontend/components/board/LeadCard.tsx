"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Bell, Check, Globe, Loader2, Mail, PenLine, Send } from "lucide-react";
import type { ReactNode } from "react";
import { TYPES, URGENCY, timeAgo } from "@/lib/labels";
import type { Channel, Lead } from "@/lib/types";

export const CHANNEL_ICONS: Record<Channel, ReactNode> = {
  form: <Globe className="size-4 text-accent" />,
  telegram: <Send className="size-4 text-[#229ED9]" />,
  manual: <Mail className="size-4 text-ink-2" />,
};

export const CHANNEL_TITLES: Record<Channel, string> = {
  form: "Форма на сайте",
  telegram: "Telegram",
  manual: "Добавлена вручную",
};

const pendingState = (lead: Lead) => lead.state === "queued" || lead.state === "running";
const isUrgent = (lead: Lead) =>
  lead.state === "done" && !!lead.triage?.notify && lead.status !== "closed" && lead.status !== "spam";

/** Маленький статус в углу карточки — как «Syncing» и «Updated» в дашбордах интеграций. */
function StatusChip({ lead, fresh }: { lead: Lead; fresh: boolean }) {
  const chip = "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold";
  if (pendingState(lead)) {
    return (
      <span className={`${chip} bg-accent text-white`}>
        <Loader2 className="size-3 animate-spin" />
        Разбор
      </span>
    );
  }
  if (lead.state === "error") {
    return (
      <span className={`${chip} border border-danger/30 bg-danger-soft text-danger`}>
        <AlertCircle className="size-3" />
        Ошибка
      </span>
    );
  }
  if (fresh) {
    return (
      <span className={`${chip} bg-ink text-white`}>
        <Check className="size-3" />
        Разобрана
      </span>
    );
  }
  if (isUrgent(lead)) {
    return (
      <span
        className={`${chip} border border-danger/30 bg-danger-soft text-danger`}
        title="Менеджер получает уведомление"
      >
        <Bell className="size-3" />
        Срочно
      </span>
    );
  }
  if (lead.edited.length) {
    return (
      <span className={`${chip} border border-line bg-sunken text-ink-3`} title="Поля поправлены вручную">
        <PenLine className="size-3" />
        Поправлено
      </span>
    );
  }
  return null;
}

export function LeadCardBody({ lead, now, fresh = false }: { lead: Lead; now: number; fresh?: boolean }) {
  const t = lead.triage;
  const pending = pendingState(lead);
  const c = t?.contacts;
  const firstContact = c?.phones[0] ?? c?.emails[0] ?? c?.telegram[0];
  // Без имени заголовком становится контакт, а под ним — откуда пришла заявка
  const name = c?.name || firstContact || (pending ? "Новая заявка" : "Без имени");
  const contact = (c?.name && firstContact) || CHANNEL_TITLES[lead.channel];

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(21,23,28,.05)]"
          title={CHANNEL_TITLES[lead.channel]}
        >
          {CHANNEL_ICONS[lead.channel]}
        </span>
        <div className="min-w-0 flex-1 pt-px">
          <p className="truncate text-sm font-semibold text-ink">{name}</p>
          <p className="truncate text-xs text-ink-3">{contact}</p>
        </div>
        <StatusChip lead={lead} fresh={fresh} />
      </div>

      <p className={`mt-2.5 line-clamp-2 text-[13px] leading-snug ${t && !pending ? "text-ink-2" : "text-ink-3"}`}>
        {t && !pending ? t.summary : lead.text}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-line/70 pt-2.5">
        {t && !pending ? (
          <>
            <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TYPES[t.type].badge}`}>
              {TYPES[t.type].label}
            </span>
            {/* У срочной в работе срочность уже на значке в углу — не повторяем */}
            {t.type !== "spam" && !isUrgent(lead) && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${URGENCY[t.urgency].text}`}>
                <span className={`size-1.5 rounded-full ${URGENCY[t.urgency].dot}`} />
                {URGENCY[t.urgency].short}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-ink-3">
            {pending ? "Нейросеть читает заявку…" : "Не удалось разобрать"}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-ink-3">{timeAgo(lead.created_at, now)}</span>
      </div>
    </>
  );
}

/** Подложка карточки: срочные — с тёплым оттенком, разбираемые — с синим, как активные карточки референса. */
function tint(lead: Lead) {
  if (pendingState(lead)) return "border-accent/25 bg-gradient-to-b from-accent-soft to-surface";
  if (isUrgent(lead)) return "border-danger/20 bg-gradient-to-b from-danger-soft/70 to-surface";
  return "border-line bg-surface";
}

const CARD = "block w-full rounded-2xl border p-3.5 text-left";

export function SortableLeadCard({
  lead,
  now,
  fresh,
  onOpen,
}: {
  lead: Lead;
  now: number;
  fresh: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { status: lead.status },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      className={`${CARD} ${tint(lead)} cursor-grab touch-manipulation shadow-[0_1px_2px_rgba(21,23,28,.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:shadow-[0_10px_24px_-14px_rgba(21,23,28,.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      } ${fresh ? "flash" : ""}`}
    >
      <LeadCardBody lead={lead} now={now} fresh={fresh} />
    </button>
  );
}

/** Карточка под курсором во время перетаскивания. */
export function DraggedLeadCard({ lead, now }: { lead: Lead; now: number }) {
  return (
    <div
      className={`${CARD} ${tint(lead)} rotate-[1.5deg] cursor-grabbing shadow-[0_24px_48px_-20px_rgba(21,23,28,.45)]`}
    >
      <LeadCardBody lead={lead} now={now} />
    </div>
  );
}
