import { ImageResponse } from "next/og";
import { LOGO_DATA_URI } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS сам скругляет иконку — знак рисуем во весь размер, без своего скругления
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#2563eb" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка для next/og, не для страницы */}
        <img src={LOGO_DATA_URI} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
