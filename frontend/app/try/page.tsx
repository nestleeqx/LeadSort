import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { TriageSandbox } from "@/components/TriageSandbox";
import { PAGE } from "@/lib/layout";

export const metadata: Metadata = {
  title: "Разбор заявки",
  description: "Вставьте текст заявки — нейросеть определит тип и срочность, найдёт контакты и подготовит ответ.",
};

export default function TryPage() {
  return (
    <div className="min-h-full">
      <AppHeader />
      <div className={`${PAGE} py-6 sm:py-8`}>
        <div className="mb-6 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Разбор заявки</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Вставьте текст письма или сообщения — нейросеть определит тип и срочность, найдёт контакты, даже если они
            написаны вперемешку, и подготовит черновик ответа клиенту.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-3">
            Это проверка без сохранения. На доску заявки попадают с сайта студии, из Telegram и через «Добавить заявку»
            — или кнопкой «Отправить на доску» после разбора.
          </p>
        </div>
        <TriageSandbox />
      </div>
    </div>
  );
}
