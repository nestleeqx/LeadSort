import {
  ArrowRight,
  Bell,
  BarChart3,
  FileSpreadsheet,
  Globe,
  Inbox,
  KanbanSquare,
  Mail,
  PenLine,
  Send,
  ShieldCheck,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

const PROBLEMS = [
  {
    title: "Заявки теряются",
    text: "Письма, сообщения в мессенджерах и формы с сайта лежат в разных местах — половину находят через день.",
  },
  {
    title: "Менеджер перепечатывает",
    text: "Телефоны и почты разбросаны по тексту, бюджет и сроки — между строк. Каждую заявку приходится разбирать руками.",
  },
  {
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

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <KanbanSquare className="size-5" />,
    title: "Канбан-доска",
    text: "Новая → В работе → Ждём клиента → Закрыта. Перетаскивание, фильтры и поиск.",
  },
  {
    icon: <ShieldOff className="size-5" />,
    title: "Спам отдельно",
    text: "Рассылки и пустые сообщения уходят в свою колонку сами — и возвращаются одной кнопкой.",
  },
  {
    icon: <PenLine className="size-5" />,
    title: "Ручная правка",
    text: "Исходный текст рядом с тем, что извлекла нейросеть. Любое поле можно поправить.",
  },
  {
    icon: <BarChart3 className="size-5" />,
    title: "Статистика",
    text: "Заявки за неделю, типы и каналы, доля спама и время разбора.",
  },
  {
    icon: <FileSpreadsheet className="size-5" />,
    title: "CSV и CRM",
    text: "Выгрузка для Excel и передача в amoCRM или Битрикс24.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Данные в России",
    text: "Работает с GPT, а если данные не должны уходить за рубеж — с YandexGPT.",
  },
];

/** Первый экран: сырое сообщение клиента и то, во что его превращает нейросеть. */
function HeroDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_50px_-30px_rgba(20,20,20,.35)]">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
          <Send className="size-3.5" />
          Сообщение в Telegram
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          здравствуйте нужно доработать сайт добавить раздел с отзывами и подключить амо срм. пишите в тг{" "}
          <mark className="hl">marina_decor</mark> или на почту{" "}
          <mark className="hl">marina.decor собака yandex точка ru</mark>, звонить после 18:00{" "}
          <mark className="hl">89031234567</mark> <mark className="hl hl-name">Марина</mark>
        </p>
      </div>
      <div className="my-3 flex justify-center text-ink-3">
        <span className="flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-accent-ink">
          <Sparkles className="size-3.5" />
          разобрано за 3,5 с
        </span>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_50px_-30px_rgba(20,20,20,.35)]">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">Доработка</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warn">
            <span className="size-1.5 rounded-full bg-warn" />
            Средняя срочность
          </span>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink">
          Добавить раздел с отзывами на сайт на Tilda и настроить передачу заявок в amoCRM.
        </p>
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-ink-3">Имя</dt>
          <dd className="text-ink">Марина</dd>
          <dt className="text-ink-3">Телефон</dt>
          <dd className="text-ink">+7 (903) 123-45-67</dd>
          <dt className="text-ink-3">Почта</dt>
          <dd className="break-all text-ink">marina.decor@yandex.ru</dd>
          <dt className="text-ink-3">Telegram</dt>
          <dd className="text-ink">@marina_decor</dd>
        </dl>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="LeadSort — на главную">
            <Logo />
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">
              Как работает
            </a>
            <a href="#features" className="hover:text-ink">
              Возможности
            </a>
          </nav>
          <Link
            href="/app"
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-ink/85 md:ml-0"
          >
            Открыть демо
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-lime-strong" />
            ИИ-разбор входящих заявок
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-ink sm:text-5xl">
            Заявки разбирает нейросеть. Менеджер только отвечает
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            LeadSort собирает заявки с сайта, из Telegram и почты, определяет тип и срочность, находит контакты и
            готовит черновик ответа. О срочных менеджер узнаёт сразу.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 font-medium text-white transition-colors hover:bg-ink/85"
            >
              Открыть демо-доску
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pixel#form"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 font-medium text-ink transition-colors hover:bg-sunken"
            >
              <Globe className="size-4" />
              Отправить заявку с сайта
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-3">Без регистрации · на доске уже 25 заявок веб-студии «Пиксель»</p>
        </div>
        <HeroDemo />
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-4 sm:grid-cols-3 sm:px-6">
          {[
            ["25 из 25", "заявок демо-набора — тип определён верно"],
            ["3–7 с", "от отправки формы до разобранной карточки на доске"],
            ["0", "уведомлений о спаме — только о срочных заявках"],
          ].map(([value, text]) => (
            <div key={value} className="py-8 sm:px-6 sm:first:pl-0">
              <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
              <p className="mt-1 text-sm text-ink-2">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-ink">Знакомо?</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-4 bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Как работает</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl bg-white/[0.06] p-5">
                <span className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-lime text-accent-ink">{s.icon}</span>
                  <span className="text-sm font-semibold text-white/40">0{i + 1}</span>
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-ink">Что нейросеть достаёт из каждой заявки</h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Контакты дополнительно сверяются с исходным текстом: телефон или почта, которых клиент не писал, в карточку не
          попадут.
        </p>
        <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {FIELDS.map(([name, text]) => (
            <div key={name} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[200px_1fr] sm:gap-4">
              <dt className="font-medium text-ink">{name}</dt>
              <dd className="text-sm leading-relaxed text-ink-2 sm:text-[15px]">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="features" className="scroll-mt-4 border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Возможности</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-line p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-sunken text-ink">{f.icon}</span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl bg-lime p-8 sm:p-12">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-accent-ink">
            Посмотрите на живых заявках: 25 штук студии «Пиксель» уже на доске
          </h2>
          <p className="mt-3 max-w-xl text-accent-ink/75">
            Перетащите карточку, поправьте поле, отправьте свою заявку с сайта студии и посмотрите, как она появится на
            доске разобранной.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 font-medium text-white transition-colors hover:bg-ink/85"
            >
              Открыть демо-доску
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/try"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white/70 px-6 font-medium text-ink transition-colors hover:bg-white"
            >
              <Mail className="size-4" />
              Проверить свой текст
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-3 sm:px-6">
          LeadSort — демо-проект. Студия «Пиксель» и её клиенты вымышлены.
        </div>
      </footer>
    </div>
  );
}
