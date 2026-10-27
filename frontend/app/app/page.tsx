import type { Metadata } from "next";
import { Board } from "@/components/board/Board";

export const metadata: Metadata = {
  title: "Доска заявок",
  description: "Заявки веб-студии «Пиксель», разобранные нейросетью: тип, срочность, контакты и черновик ответа.",
  // Доска у каждого посетителя своя — индексировать нечего
  robots: { index: false, follow: false },
};

export default function BoardPage() {
  return <Board />;
}
