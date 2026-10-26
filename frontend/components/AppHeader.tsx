"use client";

import { BarChart3, Globe, KanbanSquare, Wand2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PAGE } from "@/lib/layout";
import { Logo, LogoMark } from "./Logo";

function NavLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // На телефоне — только иконка: четыре подписи в строку не помещаются
      aria-label={label}
      title={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors ${
        active ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-sunken/70 hover:text-ink"
      }`}
    >
      {icon}
      <span className="max-sm:hidden">{label}</span>
    </Link>
  );
}

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className={`${PAGE} flex h-14 items-center gap-3 sm:gap-6`}>
        <Link href="/" aria-label="LeadSort — на главную">
          {/* На телефоне — только знак, чтобы поместилось меню */}
          <span className="max-sm:hidden">
            <Logo />
          </span>
          <LogoMark className="size-7 sm:hidden" />
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/app" icon={<KanbanSquare className="size-4" />} label="Доска" />
          <NavLink href="/app/stats" icon={<BarChart3 className="size-4" />} label="Статистика" />
          <NavLink href="/pixel" icon={<Globe className="size-4" />} label="Сайт студии" />
          <NavLink href="/try" icon={<Wand2 className="size-4" />} label="Проверить разбор" />
        </nav>
        <span className="ml-auto text-xs text-ink-3 max-md:hidden">Демо: веб-студия «Пиксель»</span>
      </div>
    </header>
  );
}
