import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Board } from "@/components/board/Board";

export const metadata: Metadata = {
  title: "Доска заявок",
  description: "Заявки веб-студии «Пиксель», разобранные нейросетью: тип, срочность, контакты и черновик ответа.",
  // Доска у каждого посетителя своя — индексировать нечего
  robots: { index: false, follow: false },
};

export default function BoardPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <Board />
    </div>
  );
}
