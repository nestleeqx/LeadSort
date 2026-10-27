import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/logo";

export const alt = "LeadSort — ИИ-разбор входящих заявок";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SPARK = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0Q8.6 7.4 16 8Q8.6 8.6 8 16Q7.4 8.6 0 8Q7.4 7.4 8 0Z" fill="#cfe0ff"/></svg>',
).toString("base64")}`;

const HEADLINE ="Заявки разбирает нейросеть. Менеджер только отвечает";
const SUBLINE = "Тип, срочность, контакты, бюджет и черновик ответа за 3–5 секунд. Срочные — сразу в Telegram";
const CHIPS = ["Форма на сайте", "Telegram", "Канбан-доска"];
const CARD = {
  type: "Доработка",
  urgency: "Средняя срочность",
  summary: "Добавить раздел с отзывами и подключить amoCRM",
  fields: [
    ["Имя", "Марина"],
    ["Телефон", "+7 (903) 123-45-67"],
    ["Telegram", "@marina_decor"],
  ],
};

/** Шрифт по умолчанию в ImageResponse не содержит кириллицы — берём Onest из Google Fonts, только нужные глифы. */
async function loadOnest(weight: number, text: string): Promise<ArrayBuffer | null> {
  "use cache";
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Onest:wght@${weight}&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const allText = ["LeadSort", HEADLINE, SUBLINE, ...CHIPS, CARD.type, CARD.urgency, CARD.summary, ...CARD.fields.flat()].join(
    "",
  );
  const [regular, bold] = await Promise.all([loadOnest(400, allText), loadOnest(600, allText)]);
  const fonts = [
    regular && { name: "Onest", data: regular, weight: 400 as const, style: "normal" as const },
    bold && { name: "Onest", data: bold, weight: 600 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => !!f);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 64,
          gap: 48,
          background: "radial-gradient(circle at 85% 30%, #dbe7ff 0%, #f4f5f8 55%)",
          color: "#15171c",
          fontFamily: "Onest",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- картинка для next/og, не для страницы */}
            <img src={LOGO_DATA_URI} width={52} height={52} alt="" />
            <span style={{ fontSize: 34, fontWeight: 600 }}>LeadSort</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 58, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>{HEADLINE}</div>
            <div style={{ fontSize: 26, color: "#4a505c", lineHeight: 1.35 }}>{SUBLINE}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {CHIPS.map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  fontSize: 22,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "#ffffff",
                  color: "#4a505c",
                  border: "1px solid #e5e7ec",
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Разобранная заявка — то, что видит менеджер */}
        <div
          style={{
            width: 380,
            alignSelf: "center",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 28,
            borderRadius: 28,
            background: "#ffffff",
            border: "1px solid #e5e7ec",
            boxShadow: "0 30px 60px -30px rgba(21,23,28,.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 18 }}>
            <div
              style={{ display: "flex", padding: "4px 10px", borderRadius: 8, background: "#f1ecff", color: "#6d4ae0" }}
            >
              {CARD.type}
            </div>
            <div style={{ display: "flex", color: "#a45a07" }}>• {CARD.urgency}</div>
          </div>
          <div style={{ fontSize: 22, lineHeight: 1.35 }}>{CARD.summary}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 18 }}>
            {CARD.fields.map(([name, value]) => (
              <div key={name} style={{ display: "flex", gap: 16 }}>
                <span style={{ width: 96, color: "#8b919c" }}>{name}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              marginTop: 4,
              padding: "6px 14px",
              borderRadius: 999,
              background: "#15171c",
              color: "#ffffff",
              fontSize: 16,
              alignItems: "center",
              gap: 8,
            }}
          >
            {/* Искра — картинкой: такого символа нет ни в Onest, ни в шрифте по умолчанию */}
            {/* eslint-disable-next-line @next/next/no-img-element -- картинка для next/og, не для страницы */}
            <img src={SPARK} width={14} height={14} alt="" />
            разобрано за 3,5 с
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
