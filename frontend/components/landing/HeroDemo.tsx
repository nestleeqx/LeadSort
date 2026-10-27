"use client";

import { BellOff, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Part = { text: string; mark?: "contact" | "name" };

// Сообщение клиента из демо-набора — контакты вперемешку, как бывает в жизни
const MESSAGE: Part[] = [
  { text: "здравствуйте, нужно доработать сайт: добавить раздел с отзывами и подключить амо срм. пишите в тг " },
  { text: "marina_decor", mark: "contact" },
  { text: " или на почту " },
  { text: "marina.decor собака yandex точка ru", mark: "contact" },
  { text: ", звонить после 18:00 " },
  { text: "89031234567", mark: "contact" },
  { text: " " },
  { text: "Марина", mark: "name" },
];
const TOTAL = MESSAGE.reduce((n, p) => n + p.text.length, 0);
// С какого символа начинается каждый кусок — чтобы «печатать» сообщение по частям
const STARTS = MESSAGE.map((_, i) => MESSAGE.slice(0, i).reduce((n, p) => n + p.text.length, 0));

const FIELDS: [string, string][] = [
  ["Имя", "Марина"],
  ["Телефон", "+7 (903) 123-45-67"],
  ["Почта", "marina.decor@yandex.ru"],
  ["Telegram", "@marina_decor"],
];

// Шаги сцены: 0 — печатается сообщение, 1 — подсветка контактов, 2 — нейросеть думает,
// 3 — карточка разобрана. Потом пауза и всё сначала
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function HeroDemo() {
  const [typed, setTyped] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Печать текста и подсветка — не движение, поэтому сцена идёт и при «уменьшить движение»;
    // выезды и парение в этом режиме отключает CSS
    let alive = true;
    (async () => {
      while (alive) {
        setStep(0);
        setTyped(0);
        await sleep(500);
        for (let i = 0; i <= TOTAL && alive; i += 3) {
          setTyped(i);
          await sleep(22);
        }
        setTyped(TOTAL);
        await sleep(400);
        if (!alive) return;
        setStep(1);
        await sleep(1100);
        if (!alive) return;
        setStep(2);
        await sleep(1500);
        if (!alive) return;
        setStep(3);
        await sleep(6500);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const parts = MESSAGE.map((p, i) => {
    const visible = p.text.slice(0, Math.max(0, typed - STARTS[i]));
    if (!visible) return null;
    if (!p.mark) return <span key={i}>{visible}</span>;
    return (
      <mark key={i} className={`hl-draw ${p.mark === "name" ? "hl-draw-name" : ""} ${step >= 1 ? "is-on" : ""}`}>
        {visible}
      </mark>
    );
  });

  return (
    <div className="relative mx-auto w-full max-w-md" aria-label="Пример: сообщение клиента и разобранная заявка">
      <div className="hero-glow pointer-events-none absolute -inset-16 -z-10" />

      <div className="float-slow rounded-3xl border border-line bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(21,23,28,.35)]">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-3">
          <span className="grid size-6 place-items-center rounded-lg bg-[#229ED9]/10 text-[#229ED9]">
            <Send className="size-3.5" />
          </span>
          Сообщение в Telegram
        </p>
        <p className="mt-3 min-h-[7.5rem] text-sm leading-relaxed text-ink-2">
          {parts}
          {typed < TOTAL && <span className="caret ml-px inline-block h-4 w-0.5 translate-y-0.5 bg-accent" />}
        </p>
      </div>

      <div className="my-3 flex h-8 justify-center">
        {step >= 2 && (
          <span
            className={`pop inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              step >= 3 ? "bg-ink text-white" : "bg-accent text-white"
            }`}
          >
            {step >= 3 ? <Sparkles className="size-3.5 text-glow" /> : <Loader2 className="size-3.5 animate-spin" />}
            {step >= 3 ? "разобрано за 3,5 с" : "нейросеть разбирает…"}
          </span>
        )}
      </div>

      <div
        className={`rounded-3xl border bg-surface p-5 shadow-[0_30px_60px_-30px_rgba(21,23,28,.35)] transition-all duration-500 ${
          step >= 3 ? "border-line opacity-100" : "translate-y-2 border-dashed border-line-strong opacity-60"
        }`}
      >
        {step >= 3 ? (
          <div className="fade-in">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">Доработка</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-warn">
                <span className="size-1.5 rounded-full bg-warn" />
                Средняя срочность
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              Добавить на сайт на Tilda раздел с отзывами и настроить передачу заявок в amoCRM.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              {FIELDS.flatMap(([name, value], i) => {
                // Поля появляются по одному, сверху вниз
                const style = { animationDelay: `${120 + i * 110}ms` };
                return [
                  <dt key={`${name}-dt`} className="rise text-ink-3" style={style}>
                    {name}
                  </dt>,
                  <dd key={`${name}-dd`} className="rise min-w-0 break-all text-ink" style={style}>
                    {value}
                  </dd>,
                ];
              })}
            </dl>
            {/* Куда легла заявка: срочность средняя, поэтому менеджера не дёргаем */}
            <p
              className="rise mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-3"
              style={{ animationDelay: "600ms" }}
            >
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="size-1.5 rounded-full bg-accent" />
                В колонке «Новая»
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <BellOff className="size-3.5" />
                без уведомления
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-2.5" aria-hidden>
            <div className="flex gap-2">
              <div className="h-5 w-20 rounded-md bg-sunken" />
              <div className="h-5 w-28 rounded-md bg-sunken" />
            </div>
            <div className="h-3.5 w-full rounded bg-sunken" />
            <div className="h-3.5 w-4/5 rounded bg-sunken" />
            <div className="h-3.5 w-3/5 rounded bg-sunken" />
          </div>
        )}
      </div>
    </div>
  );
}
