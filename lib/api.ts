import { Platform } from 'react-native';
import { CORE_URL, DENTAI_API_URL } from '../constants/config';

// Запросы к шлюзу ДентИИ / ИИ-Пациента с таймаутом и понятными причинами ошибок.
// Без таймаута в авиарежиме на iPhone запрос не падает, а висит — и индикатор
// «печатает…» крутился бесконечно.

export type ApiErrorKind = 'offline' | 'timeout' | 'network' | 'server';

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string) {
    super(message);
  }
}

/** Сейчас точно нет интернета? На native без NetInfo не знаем — считаем, что есть. */
export function isKnownOffline(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Сколько ждать ответа на проверку связи (GET /health шлюза).
const PROBE_TIMEOUT_MS = 6000;

/**
 * POST на шлюз. `probeUrl` — лёгкий GET того же сервера: он идёт параллельно
 * с основным запросом, и если не ответил за PROBE_TIMEOUT_MS, основной запрос
 * отменяется сразу. Иначе без сети пришлось бы ждать весь `timeoutMs` (ответ
 * модели бывает долгим): в авиарежиме iOS запрос висит, а navigator.onLine
 * при этом может оставаться true.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
  probeUrl?: string,
  credentials: RequestCredentials = 'same-origin'
): Promise<T> {
  if (isKnownOffline()) throw new ApiError('offline', 'Нет подключения к интернету.');

  const controller = new AbortController();
  let reason: ApiErrorKind = 'timeout';
  const abort = (kind: ApiErrorKind) => {
    if (controller.signal.aborted) return;
    reason = kind;
    controller.abort();
  };
  const timer = setTimeout(() => abort('timeout'), timeoutMs);
  let answered = false; // ответ пришёл — проверка связи уже ничего не отменяет
  if (probeUrl) probe(probeUrl).then((ok) => { if (!ok && !answered) abort('network'); });

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials,
    });
    answered = true;
  } catch {
    if (isKnownOffline()) throw new ApiError('offline', 'Нет подключения к интернету.');
    if (controller.signal.aborted) {
      throw reason === 'timeout'
        ? new ApiError('timeout', 'Сервер долго не отвечает.')
        : new ApiError('network', 'Не удалось связаться с сервером.');
    }
    throw new ApiError('network', 'Не удалось связаться с сервером.');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError('server', (data && typeof data.error === 'string' && data.error) || 'Сервер вернул ошибку. Попробуйте ещё раз.');
  }
  return data as T;
}

// ДентИИ и ИИ-Пациент: со входом — через ядро (cookie сессии, лимиты на
// пользователя; ядро передаёт запрос шлюзу за рубежом), без входа — напрямую
// в шлюз (локальная разработка, стенд на Railway).
const AI_BASE = CORE_URL || DENTAI_API_URL;
const AI_CREDENTIALS: RequestCredentials = CORE_URL ? 'include' : 'same-origin';

/** POST к ДентИИ / ИИ-Пациенту, path — например '/api/dentai/ask'. */
export function aiPost<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  return postJson<T>(AI_BASE + path, body, timeoutMs, AI_BASE + '/health', AI_CREDENTIALS);
}

/** GET к ДентИИ (например, полный текст источника). */
export function aiGet(path: string): Promise<Response> {
  return fetch(AI_BASE + path, { credentials: AI_CREDENTIALS });
}

/** true, если сервер ответил на GET за PROBE_TIMEOUT_MS (любым статусом). */
async function probe(url: string): Promise<boolean> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), PROBE_TIMEOUT_MS);
  try {
    // no-cors: ответ читать не нужно, важно лишь, что сервер отозвался —
    // и CORS-заголовки на /health тогда не требуются (у ядра их там нет)
    await fetch(url, { cache: 'no-store', mode: 'no-cors', signal: c.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Текст для плашки с ошибкой. `what` — «ДентИИ» / «Пациент». */
export function errorText(e: unknown, what: string): string {
  if (!(e instanceof ApiError)) return 'Что-то пошло не так. Попробуйте ещё раз.';
  switch (e.kind) {
    case 'offline':
      return `Нет подключения к интернету. ${what} работает только онлайн — подключитесь и нажмите «Повторить».`;
    case 'timeout':
      return 'Сервер долго не отвечает. Проверьте подключение и нажмите «Повторить».';
    case 'network':
      return 'Нет связи с сервером. Проверьте подключение к интернету и нажмите «Повторить».';
    case 'server':
      return e.message;
  }
}
