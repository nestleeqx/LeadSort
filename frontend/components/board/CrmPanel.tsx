"use client";

import { ChevronRight, Send } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/labels";
import type { Crm, CrmRequest, LeadDetail } from "@/lib/types";
import { useToast } from "../Toast";
import { Button, Panel } from "../ui";

const CRM_NAMES: Record<Crm, string> = { amocrm: "amoCRM", bitrix24: "Битрикс24" };

/** Номер сделки из типичного ответа CRM — для строки журнала. */
function dealId(entry: CrmRequest): string | null {
  const body = entry.response.body as { id?: number }[] | { result?: number };
  if (Array.isArray(body)) return body[0]?.id ? String(body[0].id) : null;
  return body?.result ? String(body.result) : null;
}

function Entry({ entry }: { entry: CrmRequest }) {
  const [open, setOpen] = useState(false);
  const id = dealId(entry);
  return (
    <li className="overflow-hidden rounded-xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sunken/60"
      >
        <ChevronRight className={`size-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="shrink-0 font-medium text-ink">{CRM_NAMES[entry.crm]}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
          ответ {entry.response.status}
          {id && `, сделка № ${id}`}
        </span>
        <span className="shrink-0 text-xs whitespace-nowrap text-ink-3 tabular-nums">{formatDateTime(entry.at)}</span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          <p className="font-mono text-[11px] break-all text-ink-2">
            {entry.request.method} {entry.request.url}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-canvas p-2.5 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-ink-2 scrollbar-thin">
            {JSON.stringify(entry.request.body, null, 2)}
          </pre>
        </div>
      )}
    </li>
  );
}

/** Передача в CRM. В демо запрос собирается и сохраняется в журнал, но никуда не уходит. */
export function CrmPanel({ lead, onSent }: { lead: LeadDetail; onSent: (lead: LeadDetail) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<Crm | null>(null);

  async function send(crm: Crm) {
    setBusy(crm);
    try {
      onSent(await api.sendToCrm(lead.id, crm));
      toast.ok(`Запрос в ${CRM_NAMES[crm]} собран — смотрите журнал`);
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  }

  const entries = [...lead.crm_requests].reverse();
  const ready = lead.state === "done" && lead.triage;

  return (
    <Panel className="rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Передать в CRM</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-3">
        Демо-режим: запрос не отправляется, а сохраняется в журнал — видно, какие поля ушли бы в CRM.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(CRM_NAMES) as Crm[]).map((crm) => (
          <Button
            key={crm}
            size="sm"
            icon={<Send className="size-3.5" />}
            loading={busy === crm}
            disabled={!ready || busy !== null}
            onClick={() => send(crm)}
          >
            {CRM_NAMES[crm]}
          </Button>
        ))}
      </div>
      {entries.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {entries.map((entry, i) => (
            <Entry key={`${entry.at}-${i}`} entry={entry} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
