"use client";

import { KanbanSquare, Wand2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PAGE } from "@/lib/layout";
import { Logo } from "./Logo";

function NavLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors ${
        active ? "bg-sunken font-medium text-ink" : "text-ink-2 hover:bg-sunken/70 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className={`${PAGE} flex h-14 items-center gap-3 sm:gap-6`}>
        <Link href="/app" aria-label="LeadSort — доска заявок">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/app" icon={<KanbanSquare className="size-4" />}>
            Доска
          </NavLink>
          <NavLink href="/try" icon={<Wand2 className="size-4" />}>
            <span className="max-sm:hidden">Проверить разбор</span>
            <span className="sm:hidden">Разбор</span>
          </NavLink>
        </nav>
        <span className="ml-auto text-xs text-ink-3 max-md:hidden">Демо: веб-студия «Пиксель»</span>
      </div>
    </header>
  );
}
