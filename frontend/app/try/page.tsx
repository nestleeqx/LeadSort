import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { TriageSandbox } from "@/components/TriageSandbox";

export const metadata: Metadata = {
  title: "Разбор заявки",
  description: "Вставьте текст заявки — нейросеть определит тип и срочность, найдёт контакты и подготовит ответ.",
};

export default function TryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
        <Logo />
        <span className="text-xs text-ink-3">Демо: веб-студия «Пиксель»</span>
      </header>
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Разбор заявки</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Вставьте текст письма или сообщения — нейросеть определит тип и срочность, найдёт контакты, даже если
          они написаны вперемешку, и подготовит черновик ответа клиенту.
        </p>
      </div>
      <TriageSandbox />
    </div>
  );
}
