/**
 * Маска телефона для полей контактов: +7 (916) 123-45-67.
 *
 * Разделители появляются только по мере ввода цифр, поэтому Backspace стирает номер
 * без «залипания» на скобке или дефисе. Зарубежный номер (+ и не 7) остаётся как есть —
 * только цифры с плюсом. Добавочный («, доб. 105») сохраняется в конце.
 */
export function maskPhone(raw: string): string {
  const ext = /,?\s*(доб\.?|добавочный|ext\.?)\s*(\d*)\s*$/i.exec(raw);
  const main = ext ? raw.slice(0, ext.index) : raw;
  const suffix = ext ? `, доб. ${ext[2]}` : "";
  const trimmed = main.trim();

  if (trimmed.startsWith("+") && !trimmed.startsWith("+7")) {
    return "+" + trimmed.replace(/\D/g, "").slice(0, 15) + suffix;
  }

  let digits = trimmed.startsWith("+7") ? trimmed.slice(2).replace(/\D/g, "") : trimmed.replace(/\D/g, "");
  // Номер начали набирать с 8 или 7 — это код страны, ждём код города
  if (!trimmed.startsWith("+") && /^[78]$/.test(digits)) return "+7 (";
  // 8 916… или 7 916… без плюса — первая цифра это код страны
  if (!trimmed.startsWith("+7") && digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (!digits) return trimmed.startsWith("+") ? trimmed.slice(0, 2) : "";

  let out = `+7 (${digits.slice(0, 3)}`;
  if (digits.length > 3) out += `) ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  return out + suffix;
}

/** Ник Telegram: без пробелов и с @ в начале. */
export function maskTelegram(raw: string): string {
  const user = raw.replace(/\s/g, "").replace(/^@+/, "");
  return user ? `@${user}` : "";
}
