import { ArrowRight, Clock, Code2, Gauge, LayoutTemplate, LifeBuoy, ShoppingBag, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { LeadForm } from "@/components/pixel/LeadForm";
import { PixelLogo } from "@/components/pixel/PixelLogo";

export const metadata: Metadata = {
  // Сайт студии — не часть LeadSort, поэтому без общей приписки к заголовку
  title: { absolute: "Веб-студия «Пиксель» — демо-сайт" },
  description: "Сайт вымышленной веб-студии: форма заявки, которая попадает на доску LeadSort уже разобранной.",
  // Студия вымышленная — в поиске ей делать нечего
  robots: { index: false, follow: false },
};

const SERVICES: { icon: ReactNode; title: string; text: string; price: string; time: string }[] = [
  {
    icon: <LayoutTemplate className="size-5" />,
    title: "Лендинг",
    text: "Одна страница под рекламу или запуск: структура, тексты, дизайн и форма заявки.",
    price: "от 60 тыс. ₽",
    time: "2–3 недели",
  },
  {
    icon: <Code2 className="size-5" />,
    title: "Корпоративный сайт",
    text: "Услуги, кейсы, команда и блог. Управляете содержимым сами, без программиста.",
    price: "от 150 тыс. ₽",
    time: "4–8 недель",
  },
  {
    icon: <ShoppingBag className="size-5" />,
    title: "Интернет-магазин",
    text: "Каталог с фильтрами, корзина, онлайн-оплата, доставка и выгрузка из учётной системы.",
    price: "от 300 тыс. ₽",
    time: "от 2 месяцев",
  },
  {
    icon: <Wrench className="size-5" />,
    title: "Доработка сайта",
    text: "Новые разделы, интеграции с CRM и сервисами, ускорение и правки дизайна.",
    price: "от 3 тыс. ₽ / час",
    time: "оценка бесплатно",
  },
  {
    icon: <LifeBuoy className="size-5" />,
    title: "Техподдержка",
    text: "Обновления, резервные копии, мелкие правки и аварийные работы в течение 4 часов.",
    price: "от 15 тыс. ₽ / мес",
    time: "по договору",
  },
];

const STEPS = [
  { title: "Заявка", text: "Отвечаем в течение часа в рабочее время и задаём уточняющие вопросы." },
  { title: "Бриф и оценка", text: "Созваниваемся, фиксируем задачу, сроки и стоимость в договоре." },
  { title: "Дизайн и разработка", text: "Показываем результат по этапам — правки вносим сразу." },
  { title: "Запуск и поддержка", text: "Переносим сайт на хостинг, подключаем аналитику, остаёмся на связи." },
];

/** Декоративная сетка пикселей на первом экране. */
function PixelArt() {
  const lit = new Set([3, 8, 9, 14, 15, 16, 20, 21, 22, 23, 27, 28, 29, 34, 35, 41]);
  const coral = new Set([16, 29]);
  return (
    <div className="grid grid-cols-7 gap-2" aria-hidden>
      {Array.from({ length: 49 }, (_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-lg ${
            coral.has(i) ? "bg-px-coral" : lit.has(i) ? "bg-px" : i % 3 === 0 ? "bg-px-soft" : "bg-white/60"
          }`}
          style={lit.has(i) ? { opacity: 0.55 + ((i * 7) % 5) / 10 } : undefined}
        />
      ))}
    </div>
  );
}

export default function PixelPage() {
  return (
    <div className="min-h-full bg-white text-px-ink">
      {/* Плашка демо: сайт студии — часть демонстрации LeadSort */}
      <div className="bg-ink text-white">
        {/* На телефоне — одна строка: короткая подпись слева, ссылка на доску справа */}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-[13px] sm:px-6">
          <LogoMark className="size-5 shrink-0" />
          <span className="min-w-0 truncate text-white/75">
            <span className="sm:hidden">
              Демо <b className="font-semibold text-white">LeadSort</b>
            </span>
            <span className="max-sm:hidden">
              Демо-сайт вымышленной студии. Заявки с формы попадают на доску{" "}
              <b className="font-semibold text-white">LeadSort</b> уже разобранными.
            </span>
          </span>
          <Link
            href="/app"
            className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium whitespace-nowrap text-lime hover:underline"
          >
            Открыть доску
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-px-soft bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <PixelLogo />
          <nav className="ml-auto hidden items-center gap-6 text-sm text-px-ink/70 md:flex">
            <a href="#services" className="hover:text-px-ink">
              Услуги и цены
            </a>
            <a href="#process" className="hover:text-px-ink">
              Как работаем
            </a>
            <a href="#contacts" className="hover:text-px-ink">
              Контакты
            </a>
          </nav>
          <a
            href="#form"
            className="ml-auto inline-flex h-10 items-center rounded-xl bg-px px-4 text-sm font-semibold text-white transition-colors hover:bg-px-hover md:ml-0"
          >
            Обсудить проект
          </a>
        </div>
      </header>

      <section className="overflow-hidden bg-gradient-to-b from-px-soft/70 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-px shadow-sm">
              <span className="size-1.5 rounded-full bg-px-coral" />
              Веб-студия с 2016 года
            </p>
            <h1 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
              Сайты, которые приносят заявки
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-px-ink/70">
              Лендинги, корпоративные сайты и интернет-магазины под ключ. Работаем по всей России, Tilda, WordPress,
              1С-Битрикс и сайты на заказ.
            </p>
            {/* На телефоне кнопки на всю ширину, одна под другой */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#form"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-px px-6 font-semibold text-white transition-colors hover:bg-px-hover"
              >
                Оставить заявку
                <ArrowRight className="size-4" />
              </a>
              <a
                href="#services"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-px-ink/15 bg-white px-6 font-semibold transition-colors hover:border-px-ink/30"
              >
                Смотреть цены
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <PixelArt />
            <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white px-4 py-3 shadow-[0_20px_40px_-20px_rgba(30,27,75,.35)]">
              <p className="text-2xl font-bold">120+</p>
              <p className="text-xs text-px-ink/60">запущенных проектов</p>
            </div>
            <div className="absolute -top-4 -right-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[0_20px_40px_-20px_rgba(30,27,75,.35)]">
              <Clock className="size-4 text-px-coral" />
              <p className="text-xs leading-tight">
                <b className="block text-sm">4 часа</b>
                <span className="text-px-ink/60">реакция на аварии</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Услуги и цены</h2>
          <p className="mt-2 text-px-ink/60">Точную стоимость считаем после брифа — оценка бесплатная.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <article key={s.title} className="flex flex-col rounded-2xl border border-px-ink/10 p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-px-soft text-px">{s.icon}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-px-ink/65">{s.text}</p>
                <p className="mt-4 flex items-baseline justify-between gap-2 border-t border-px-ink/10 pt-3">
                  <span className="font-semibold">{s.price}</span>
                  <span className="text-xs text-px-ink/55">{s.time}</span>
                </p>
              </article>
            ))}
            <article className="flex flex-col justify-between rounded-2xl bg-px p-5 text-white">
              <Gauge className="size-6 text-white/80" />
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Не знаете, что выбрать?</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                  Опишите задачу своими словами — подскажем решение и бюджет.
                </p>
              </div>
              <a href="#form" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
                Оставить заявку
                <ArrowRight className="size-4" />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section id="process" className="scroll-mt-20 bg-px-soft/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Как мы работаем</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-white p-5">
                <span className="text-sm font-bold text-px-coral">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-px-ink/65">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="form" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Расскажите о задаче</h2>
          <p className="mt-2 max-w-2xl text-px-ink/60">
            Опишите, что нужно сделать, и оставьте удобный контакт — телефон, почту или Telegram. Ответим в течение часа
            в рабочее время.
          </p>
          <div className="mt-8">
            <LeadForm />
          </div>
        </div>
      </section>

      <footer id="contacts" className="scroll-mt-20 bg-px-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <PixelLogo light />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Сайты, которые приносят заявки. Пн–пт 10:00–19:00 по Москве.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Контакты</p>
            <p className="mt-2 text-white/60">hello@pixel-studio.example</p>
            <p className="text-white/60">+7 (900) 000-00-00</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Демо</p>
            <p className="mt-2 text-white/60">
              Студия, контакты и цены вымышлены — это сайт для демонстрации LeadSort.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
