/** Знак LeadSort: три колонки доски, заявки в них разложены по полочкам. Тот же рисунок — в app/icon.svg. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#141414" />
      <rect x="7" y="7.5" width="5" height="17" rx="2" fill="#c8f26b" />
      <rect x="13.5" y="7.5" width="5" height="12" rx="2" fill="#c8f26b" opacity=".7" />
      <rect x="20" y="7.5" width="5" height="7.5" rx="2" fill="#c8f26b" opacity=".45" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
      <LogoMark />
      LeadSort
    </span>
  );
}
