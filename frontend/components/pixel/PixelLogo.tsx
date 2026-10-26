/** Логотип вымышленной студии «Пиксель»: четыре пикселя, один — акцентный. */
export function PixelLogo({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2 text-[17px] font-semibold tracking-tight ${light ? "text-white" : "text-px-ink"}`}
    >
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect x="2" y="2" width="9" height="9" rx="2" fill="#4f46e5" />
        <rect x="13" y="2" width="9" height="9" rx="2" fill="#4f46e5" opacity=".35" />
        <rect x="2" y="13" width="9" height="9" rx="2" fill="#4f46e5" opacity=".35" />
        <rect x="13" y="13" width="9" height="9" rx="2" fill="#ff7a59" />
      </svg>
      Пиксель
    </span>
  );
}
