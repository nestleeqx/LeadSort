import {
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  FileSpreadsheet,
  Globe,
  Inbox,
  KanbanSquare,
  MessagesSquare,
  PenLine,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BoardPreview } from "@/components/landing/BoardPreview";
import { CountUp } from "@/components/landing/CountUp";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { LeadTicker } from "@/components/landing/LeadTicker";
import { Reveal } from "@/components/landing/Reveal";
import { Logo } from "@/components/Logo";

const PROBLEMS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <MessagesSquare className="size-5" />,
    title: "Заявки теряются",
    text: "Письма, сообщения в мессенджерах и формы с сайта лежат в разных местах — половину находят через день.",
  },
  {
    icon: <PenLine className="size-5" />,
    title: "Менеджер перепечатывает",
    text: "Телефоны и почты разбросаны по тексту, бюджет и сроки — между строк. Каждую заявку приходится разбирать руками.",
  },
  {
    icon: <Clock className="size-5" />,
    title: "Срочное тонет в спаме",
    text: "Клиент, у которого упал сайт, ждёт ответа, пока менеджер листает рассылки про SEO и «заработок без вложений».",
  },
];

const STEPS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Inbox className="size-5" />,
    title: "Приём",
    text: "Форма на сайте, Telegram-бот или текст письма — всё приходит в одно место.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Разбор нейросетью",
    text: "За 3–5 секунд: тип, срочность, контакты, бюджет, сроки и черновик ответа.",
  },
  {
    icon: <KanbanSquare className="size-5" />,
    title: "Доска",
    text: "Заявка уже разобрана и стоит в колонке «Новая». Спам — в отдельной колонке.",
  },
  {
    icon: <Bell className="size-5" />,
    title: "Уведомление",
    text: "О срочных заявках менеджер узнаёт в Telegram сразу, о спаме — никогда.",
  },
];

const FIELDS = [
  ["Тип", "Новый сайт, доработка, поддержка, вопрос или спам"],
  ["Срочность", "Высокая — «сайт не работает, теряем заказы», и причина одной фразой"],
  ["Контакты", "Имя, телефон, почта и Telegram — даже если написаны вперемешку"],
  ["Бюджет и сроки", "«до 100 тыс. ₽», «к концу месяца» или «не указано»"],
  ["Резюме", "1–2 предложения: что хочет клиент"],
  ["Чего не хватает", "Вопросы, которые нужно задать клиенту"],
  ["Черновик ответа", "Вежливый ответ с уточняющими вопросами — менеджер правит и копирует"],
];

const FEATURES: { icon: ReactNode; title: string; text: string; tone: string }[] = [
  {
    icon: <KanbanSquare className="size-5" />,
    title: "Канбан-доска",
    text: "Новая → В работе → Ждём клиента → Закрыта. Перетаскивание, фильтры и поиск.",
    tone: "bg-accent-soft text-accent",
  },
  {
    icon: <ShieldOff className="size-5" />,
    title: "Спам отдельно",
    text: "Рассылки и пустые сообщения уходят в свою колонку сами — и возвращаются одной кнопкой.",
    tone: "bg-danger-soft text-danger",
  },
  {
    icon: <PenLine className="size-5" />,
    title: "Ручная правка",
    text: "Исходный текст рядом с тем, что извлекла нейросеть. Любое поле можно поправить.",
    tone: "bg-info-soft text-info",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Статистика",
    text: "Заявки за неделю, типы и каналы, доля спама и время разбора.",
    tone: "bg-success-soft text-success",
  },
  {
    icon: <FileSpreadsheet className="size-5" />,
    title: "CSV и CRM",
    text: "Выгрузка для Excel и передача в amoCRM или Битрикс24.",
    tone: "bg-warn-soft text-warn",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Данные в России",
    text: "Работает с GPT, а если данные не должны уходить за рубеж — с YandexGPT.",
    tone: "bg-sunken text-ink-2",
  },
];

const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-medium whitespace-nowrap sm:px-6 text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.6)] transition-colors hover:bg-accent-hover";
const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 font-medium whitespace-nowrap sm:px-6 text-ink transition-colors hover:bg-sunken";

export default function Home() {
  return (
    <div className="min-h-full overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="LeadSort — на главную">
            <Logo />
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">
              Как работает
            </a>
            <a href="#board" className="hover:text-ink">
              Доска
            </a>
            <a href="#features" className="hover:text-ink">
              Возможности
            </a>
          </nav>
          <Link
            href="/app"
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover md:ml-0"
          >
            Открыть демо
          </Link>
        </div>
      </header>

      <section className="relative">
        <div className="dot-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-[0_1px_2px_rgba(21,23,28,.05)]">
              <span className="size-1.5 rounded-full bg-accent" />
              ИИ-разбор входящих заявок
            </p>
            <h1
              className="rise mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-ink sm:text-5xl"
              style={{ animationDelay: "80ms" }}
            >
              Заявки разбирает нейросеть. Менеджер{" "}
              <span className="bg-gradient-to-r from-accent to-info bg-clip-text text-transparent">
                только отвечает
              </span>
            </h1>
            <p className="rise mt-5 max-w-xl text-lg leading-relaxed text-ink-2" style={{ animationDelay: "160ms" }}>
              LeadSort собирает заявки с сайта, из Telegram и почты, определяет тип и срочность, находит контакты и
              готовит черновик ответа. О срочных менеджер узнаёт сразу.
            </p>
            <div className="rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
              <Link href="/app" className={PRIMARY}>
                Открыть демо-доску
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/pixel#form" className={SECONDARY}>
                <Globe className="size-4" />
                Отправить заявку с сайта
              </Link>
            </div>
            <p className="rise mt-4 text-sm text-ink-3" style={{ animationDelay: "320ms" }}>
              Без регистрации · на доске уже 25 заявок веб-студии «Пиксель»
            </p>
          </div>
          <HeroDemo />
        </div>
      </section>

      <LeadTicker />

      <section className="mx-auto grid max-w-6xl gap-3 px-4 py-12 sm:grid-cols-3 sm:px-6">
        {[
          { value: <CountUp to={25} />, suffix: " из 25", text: "заявок демо-набора — тип определён верно" },
          { value: "3–7", suffix: " с", text: "от отправки формы до разобранной карточки на доске" },
          { value: "0", suffix: "", text: "уведомлений о спаме — только о срочных заявках" },
        ].map((m, i) => (
          <Reveal key={m.text} delay={i * 100} className="rounded-2xl border border-line bg-surface p-6">
            <p className="text-4xl font-semibold tracking-tight text-ink">
              {m.value}
              <span className="text-ink-3">{m.suffix}</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">{m.text}</p>
          </Reveal>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Знакомо?</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={i * 120} className="rounded-2xl border border-line bg-surface p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-danger-soft text-danger">{p.icon}</span>
              <h3 className="mt-4 font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-16 bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">Как работает</h2>
            <p className="mt-2 max-w-xl text-white/60">От сообщения клиента до карточки на доске — несколько секунд.</p>
          </Reveal>
          <Reveal className="relative mt-10">
            {/* Линия между шагами прорисовывается слева направо; карточки непрозрачные — она видна только в промежутках */}
            <div className="absolute top-11 right-[12%] left-[12%] hidden h-px bg-white/10 lg:block">
              <div className="step-line h-full bg-gradient-to-r from-accent via-info to-glow-strong" />
            </div>
            <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="rise relative rounded-2xl bg-[#1f2229] p-5"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  <span className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl bg-accent text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,.8)]">
                      {s.icon}
                    </span>
                    <span className="text-sm font-semibold text-white/40">0{i + 1}</span>
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section
        id="board"
        className="mx-auto grid max-w-6xl scroll-mt-16 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.15fr]"
      >
        <Reveal>
          <p className="text-sm font-medium text-accent">Доска заявок</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-ink">
            Заявка приходит уже разобранной — остаётся ответить
          </h2>
          <p className="mt-4 text-ink-2">
            Новые заявки встают наверх колонки «Новая», срочные подсвечены, спам отсеян. Карточки перетаскиваются между
            колонками, а на телефоне колонки переключаются вкладками.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-ink-2">
            {[
              "Исходный текст рядом с тем, что извлекла нейросеть",
              "Любое поле можно поправить, история всё запомнит",
              "Черновик ответа — скопировать и отправить клиенту",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={150}>
          <BoardPreview />
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Что нейросеть достаёт из каждой заявки</h2>
          <p className="mt-2 max-w-2xl text-ink-2">
            Контакты дополнительно сверяются с исходным текстом: телефон или почта, которых клиент не писал, в карточку
            не попадут.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {FIELDS.map(([name, text]) => (
              <div
                key={name}
                className="grid gap-1 px-5 py-4 transition-colors hover:bg-accent-soft/40 sm:grid-cols-[200px_1fr] sm:gap-4"
              >
                <dt className="font-medium text-ink">{name}</dt>
                <dd className="text-sm leading-relaxed text-ink-2 sm:text-[15px]">{text}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-12 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Возможности</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 3) * 100}
              className="group rounded-2xl border border-line bg-surface p-6 transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(21,23,28,.35)]"
            >
              <span
                className={`grid size-11 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${f.tone}`}
              >
                {f.icon}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-12">
          <div className="hero-glow pointer-events-none absolute -inset-20 opacity-80" />
          <div className="relative">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance">
              Посмотрите на живых заявках: 25 штук студии «Пиксель» уже на доске
            </h2>
            <p className="mt-3 max-w-xl text-white/70">
              Перетащите карточку, поправьте поле, отправьте свою заявку с сайта студии и посмотрите, как она появится
              на доске разобранной.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/app" className={PRIMARY}>
                Открыть демо-доску
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/try"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 font-medium whitespace-nowrap text-white sm:px-6 transition-colors hover:bg-white/10"
              >
                <Wand2 className="size-4" />
                Проверить свой текст
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-3 sm:px-6">
          LeadSort — демо-проект. Студия «Пиксель» и её клиенты вымышлены.
        </div>
      </footer>
    </div>
  );
}
