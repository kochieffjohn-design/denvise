import { Platform } from 'react-native';

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

export async function postJson<T>(url: string, body: unknown, timeoutMs: number): Promise<T> {
  if (isKnownOffline()) throw new ApiError('offline', 'Нет подключения к интернету.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new ApiError('timeout', 'Сервер долго не отвечает.');
    if (isKnownOffline()) throw new ApiError('offline', 'Нет подключения к интернету.');
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

/** Текст для плашки с ошибкой. `what` — «ДентИИ» / «Пациент». */
export function errorText(e: unknown, what: string): string {
  if (!(e instanceof ApiError)) return 'Что-то пошло не так. Попробуйте ещё раз.';
  switch (e.kind) {
    case 'offline':
      return `Нет подключения к интернету. ${what} работает только онлайн — подключитесь и нажмите «Повторить».`;
    case 'timeout':
      return 'Сервер долго не отвечает. Проверьте подключение и нажмите «Повторить».';
    case 'network':
      return 'Не удалось связаться с сервером. Проверьте подключение и нажмите «Повторить».';
    case 'server':
      return e.message;
  }
}
