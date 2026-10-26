import type { Board, Column, Lead, LeadDetail, Limits, Triage, TriageResponse } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const VISITOR_KEY = "leadsort:visitor";

/** Анонимный id посетителя: у каждого своя доска с копией демо-заявок. */
export function visitorId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
  } catch {
    // Приватный режим без localStorage — id живёт до перезагрузки
    id ??= (globalThis as { __visitor?: string }).__visitor ??= crypto.randomUUID();
  }
  return id;
}

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
  headers.set("X-Visitor-Id", visitorId());
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

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  limits: () => request<Limits>("/api/limits"),
  triage: (text: string) => request<TriageResponse>("/api/triage", json("POST", { text })),

  board: () => request<Board>("/api/leads"),
  lead: (id: string) => request<LeadDetail>(`/api/leads/${id}`),
  addLead: (text: string) => request<Lead>("/api/leads", json("POST", { text })),
  submitForm: (body: { name: string; contact: string; message: string }) =>
    request<Lead>("/api/form", json("POST", body)),
  /** Без position карточка встаёт наверх колонки. */
  moveLead: (id: string, status: Column, position?: number) =>
    request<Lead>(`/api/leads/${id}`, json("PATCH", { status, position })),
  editLead: (id: string, patch: Partial<Omit<Triage, "notify">>) =>
    request<LeadDetail>(`/api/leads/${id}/triage`, json("PATCH", patch)),
  retriage: (id: string) => request<LeadDetail>(`/api/leads/${id}/retriage`, json("POST")),
  resetDemo: () => request<Board>("/api/demo/reset", json("POST")),
};
