import type { Limits, TriageResponse } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const NETWORK_ERROR = "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.";
const SERVER_ERROR = "Что-то пошло не так. Попробуйте ещё раз через минуту.";

/** Текст ошибки для пользователя: понятные сообщения API показываем как есть,
 *  технические (коды 5xx, ответы валидации FastAPI) заменяем общими формулировками. */
async function errorMessage(resp: Response): Promise<string> {
  let detail: unknown;
  try {
    detail = (await resp.json()).detail;
  } catch {}
  // 502 — наш ответ «нейросеть не ответила», он уже написан для пользователя
  if (typeof detail === "string" && (resp.status < 500 || resp.status === 502)) return detail;
  if (resp.status === 422) return "Проверьте введённые данные и попробуйте ещё раз.";
  return SERVER_ERROR;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");

  let resp: Response;
  try {
    resp = await fetch(API_URL + path, { ...init, headers });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }
  if (!resp.ok) throw new ApiError(await errorMessage(resp), resp.status);
  return resp.json();
}

export const api = {
  limits: () => request<Limits>("/api/limits"),
  triage: (text: string) =>
    request<TriageResponse>("/api/triage", { method: "POST", body: JSON.stringify({ text }) }),
};
