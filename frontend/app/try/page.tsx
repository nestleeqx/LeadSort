import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { TriageSandbox } from "@/components/TriageSandbox";
import { PAGE } from "@/lib/layout";

export const metadata: Metadata = {
  title: "Проверить разбор",
  description: "Вставьте текст заявки — нейросеть определит тип и срочность, найдёт контакты и подготовит ответ.",
};

export default function TryPage() {
  return (
    <AppShell>
      <div className={`${PAGE} py-5 sm:py-7`}>
        <div className="mb-6 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Проверить разбор</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
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
    </AppShell>
  );
}
