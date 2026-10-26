// Адрес сайта для canonical и Open Graph. Если NEXT_PUBLIC_SITE_URL не задан,
// на Vercel берём адрес продакшена, который платформа сама передаёт в сборку Next.js.
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE = {
  name: "LeadSort",
  title: "LeadSort — ИИ-разбор входящих заявок",
  description:
    "Заявки с сайта, из Telegram и почты разбираются нейросетью: тип, срочность, контакты, бюджет и черновик ответа. Менеджер видит всё на канбан-доске, срочные — сразу в Telegram.",
};
