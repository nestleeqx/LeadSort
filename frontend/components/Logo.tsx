/** Знак LeadSort: заявки разложены по важности, искра — нейросеть, которая их разобрала. Тот же рисунок — в app/icon.svg. */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2563eb" />
      <rect x="7.5" y="8.5" width="15" height="3.2" rx="1.6" fill="#ffffff" />
      <rect x="7.5" y="14.4" width="10" height="3.2" rx="1.6" fill="#ffffff" opacity=".8" />
      <rect x="7.5" y="20.3" width="5.5" height="3.2" rx="1.6" fill="#ffffff" opacity=".6" />
      <path d="M21.5 15.2Q21.9 20.1 26.8 20.5Q21.9 20.9 21.5 25.8Q21.1 20.9 16.2 20.5Q21.1 20.1 21.5 15.2Z" fill="#cfe0ff" />
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
