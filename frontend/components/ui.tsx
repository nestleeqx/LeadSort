import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-ink text-white hover:bg-ink/85 shadow-[0_1px_0_rgba(0,0,0,.08)]",
  secondary: "border border-line bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
};

export function buttonClasses(variant: keyof typeof VARIANTS = "secondary", size: "sm" | "md" = "md") {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 ${
    size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3.5 text-sm"
  } ${VARIANTS[variant]}`;
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button {...props} disabled={disabled || loading} className={`${buttonClasses(variant, size)} ${className}`}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>;
}

export function SectionLabel({ children, className = "mb-1.5" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-medium tracking-wide text-ink-3 uppercase ${className}`}>{children}</p>;
}
