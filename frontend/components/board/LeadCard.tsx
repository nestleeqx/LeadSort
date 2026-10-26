"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Bell, Globe, Loader2, PenLine, Send, Type } from "lucide-react";
import type { ReactNode } from "react";
import { TYPES, URGENCY, timeAgo } from "@/lib/labels";
import type { Channel, Lead } from "@/lib/types";

const CHANNEL_ICONS: Record<Channel, ReactNode> = {
  form: <Globe className="size-3.5" />,
  telegram: <Send className="size-3.5" />,
  manual: <Type className="size-3.5" />,
};

export const CHANNEL_TITLES: Record<Channel, string> = {
  form: "Форма на сайте",
  telegram: "Telegram",
  manual: "Добавлена вручную",
};

/** Кто написал: имя или первый найденный контакт. */
function author(lead: Lead) {
  const c = lead.triage?.contacts;
  if (!c) return "";
  const contact = c.phones[0] ?? c.emails[0] ?? c.telegram[0] ?? "";
  return [c.name, contact].filter(Boolean).join(" · ");
}

export function LeadCardBody({ lead, now }: { lead: Lead; now: number }) {
  const t = lead.triage;
  const pending = lead.state === "queued" || lead.state === "running";
  const who = author(lead);

  return (
    <>
      <div className="flex items-center gap-2">
        {t && !pending ? (
          <>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${TYPES[t.type].badge}`}>
              {TYPES[t.type].label}
            </span>
            {t.type !== "spam" && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${URGENCY[t.urgency].text}`}>
                <span className={`size-1.5 rounded-full ${URGENCY[t.urgency].dot}`} />
                {URGENCY[t.urgency].short}
              </span>
            )}
          </>
        ) : pending ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-info">
            <Loader2 className="size-3 animate-spin" />
            Разбираем…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger">
            <AlertCircle className="size-3" />
            Не удалось разобрать
          </span>
        )}
        <span
          className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-ink-3"
          title={CHANNEL_TITLES[lead.channel]}
        >
          {CHANNEL_ICONS[lead.channel]}
          {timeAgo(lead.created_at, now)}
        </span>
      </div>

      {who && <p className="mt-2 truncate text-[13px] font-medium text-ink">{who}</p>}
      <p className={`mt-1 line-clamp-3 text-[13px] leading-snug ${t && !pending ? "text-ink-2" : "text-ink-3"}`}>
        {t && !pending ? t.summary : lead.text}
      </p>

      {t && !pending && (t.notify || lead.edited.length > 0) && (
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-ink-3">
          {t.notify && (
            <span className="inline-flex items-center gap-1" title="Срочная заявка: уведомление менеджеру в Telegram">
              <Bell className="size-3" />
              Telegram
            </span>
          )}
          {lead.edited.length > 0 && (
            <span className="inline-flex items-center gap-1" title="Поля поправлены вручную">
              <PenLine className="size-3" />
              поправлено
            </span>
          )}
        </div>
      )}
    </>
  );
}

const CARD = "block w-full rounded-xl border bg-surface p-3 text-left shadow-[0_1px_0_rgba(0,0,0,.03)]";

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
  const urgent = lead.triage?.notify && lead.state === "done";

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      className={`${CARD} cursor-grab touch-manipulation transition-[border-color,box-shadow] hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing ${
        urgent ? "border-danger/35" : "border-line"
      } ${isDragging ? "opacity-40" : ""} ${fresh ? "flash" : ""}`}
    >
      <LeadCardBody lead={lead} now={now} />
    </button>
  );
}

/** Карточка под курсором во время перетаскивания. */
export function DraggedLeadCard({ lead, now }: { lead: Lead; now: number }) {
  return (
    <div
      className={`${CARD} rotate-[1.5deg] cursor-grabbing border-line-strong shadow-[0_18px_40px_-16px_rgba(20,20,20,.35)]`}
    >
      <LeadCardBody lead={lead} now={now} />
    </div>
  );
}
