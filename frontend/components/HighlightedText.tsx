import type { ReactNode } from "react";
import type { Highlight } from "@/lib/types";

/** Исходный текст заявки с подсветкой найденных контактов и имени. */
export function HighlightedText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const h of highlights) {
    if (h.start < pos) continue;
    parts.push(text.slice(pos, h.start));
    parts.push(
      <mark key={h.start} className={h.kind === "name" ? "hl hl-name" : "hl"}>
        {text.slice(h.start, h.end)}
      </mark>,
    );
    pos = h.end;
  }
  parts.push(text.slice(pos));
  return <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-2">{parts}</p>;
}

export function HighlightLegend() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-ink-3">
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-sm bg-glow-strong" /> контакты
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-sm bg-[#b9a6f5]" /> имя
      </span>
    </span>
  );
}
