import type { Context } from 'hono';

// ДентИИ и ИИ-Пациент: приложение обращается к ядру, ядро — к LLM-шлюзу за
// рубежом (из России OpenRouter недоступен, а Railway недоступен телефонам).
// Шлюзу уходит только текст диалога: ни id, ни почты, ни IP пользователя.

// Ответ модели бывает долгим, но не бесконечным
const GATEWAY_TIMEOUT_MS = 90_000;
const MAX_BODY_BYTES = 256 * 1024;

/** Сколько запросов к ИИ на пользователя — защита от залипшего клиента и злоупотреблений. */
export const AI_LIMIT = { max: 20, windowMs: 5 * 60_000 };

export class UserRateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number, private now = () => Date.now()) {}

  /** true — запрос можно выполнить (и он засчитан). */
  take(userId: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(userId) ?? []).filter((at) => t - at < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(userId, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(userId, recent);
    // Старые записи не копим: чистим, когда пользователей набралось много
    if (this.hits.size > 10_000) {
      for (const [id, list] of this.hits) if (!list.some((at) => t - at < this.windowMs)) this.hits.delete(id);
    }
    return true;
  }
}

export type GatewayConfig = { url: string; key?: string; fetchImpl?: typeof fetch };

/** Передаёт запрос шлюзу и возвращает его ответ как есть (тексты ошибок шлюза уже на русском). */
export async function forward(c: Context, gw: GatewayConfig, path: string, method: 'GET' | 'POST') {
  let body: string | undefined;
  if (method === 'POST') {
    body = await c.req.text();
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return c.json({ error: 'Слишком длинный диалог. Начните новый чат.' }, 413);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (gw.key) headers['X-Gateway-Key'] = gw.key;

  let res: Response;
  try {
    res = await (gw.fetchImpl ?? fetch)(gw.url.replace(/\/$/, '') + path, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'TimeoutError';
    console.error(`[gateway] ${method} ${path}: ${timeout ? 'нет ответа за ' + GATEWAY_TIMEOUT_MS / 1000 + ' с' : String(err)}`);
    return timeout
      ? c.json({ error: 'ИИ долго не отвечает. Попробуйте ещё раз через минуту.' }, 504)
      : c.json({ error: 'Не удалось связаться с ИИ. Попробуйте ещё раз через минуту.' }, 502);
  }

  const text = await res.text();
  if (res.status >= 500) console.error(`[gateway] ${method} ${path}: шлюз ответил ${res.status}`);
  if (res.status === 429) console.warn(`[gateway] ${method} ${path}: лимит шлюза — проверьте GATEWAY_KEY на Railway`);
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
