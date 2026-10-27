import { AppShell } from "@/components/shell/AppShell";

/** Доска и статистика — в общем каркасе: боковое меню и верхняя панель с поиском. */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <AppShell>{children}</AppShell>;
}
