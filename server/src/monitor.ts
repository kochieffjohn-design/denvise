// Мониторинг: шлюз за рубежом присматривает за ядром и сайтом в России и
// пишет владельцу в Telegram (из Yandex Cloud Telegram недоступен, поэтому
// тревоги ядра тоже идут через шлюз — см. /internal/alert в index.ts).
// Включается, когда заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
const CHAT = process.env.TELEGRAM_CHAT_ID?.trim() || '';
export const monitorEnabled = !!(TOKEN && CHAT);

// Что проверять: «Название|адрес» через запятую
const TARGETS = (process.env.MONITOR_TARGETS || 'Ядро и база|https://api.denvise.ru/health,Сайт|https://denvise.ru/')
  .split(',')
  .map((s) => s.trim().split('|'))
  .filter((p): p is [string, string] => p.length === 2 && !!p[0] && !!p[1]);

const CHECK_EVERY_MS = 60_000;
const FAILS_BEFORE_ALERT = 2; // одиночный сбой сети — не повод будить
const CREDIT_EVERY_MS = 60 * 60_000;
const CREDIT_LOW_SHARE = 0.2;
const LLM_FAILS_BEFORE_ALERT = 3;

// Не больше 30 сообщений в час — чтобы сбой не превратился в поток сообщений
const MAX_PER_HOUR = 30;
let sentTimes: number[] = [];

/** Сообщение владельцу. Ошибки не бросает: мониторинг не должен ронять шлюз. */
export async function notify(text: string): Promise<boolean> {
  if (!monitorEnabled) return false;
  const now = Date.now();
  sentTimes = sentTimes.filter((t) => now - t < 3_600_000);
  if (sentTimes.length >= MAX_PER_HOUR) {
    console.warn('[monitor] лимит сообщений в час, не отправлено:', text.slice(0, 100));
    return false;
  }
  sentTimes.push(now);
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: text.slice(0, 3500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('[monitor] Telegram ответил', res.status);
    return res.ok;
  } catch (err) {
    console.error('[monitor] Telegram недоступен:', String(err));
    return false;
  }
}

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/** Состояние одной проверки: тревога после N сбоев подряд, сообщение о восстановлении. */
export class Watch {
  private fails = 0;
  private downSince = 0;
  constructor(private name: string, private failsBeforeAlert: number, private send = notify) {}

  async report(ok: boolean, detail = '') {
    if (ok) {
      if (this.downSince) {
        await this.send(`✅ ${this.name}: снова работает (не работало ~${minutes(Date.now() - this.downSince)} мин)`);
      }
      this.fails = 0;
      this.downSince = 0;
      return;
    }
    this.fails++;
    if (this.fails === this.failsBeforeAlert) {
      this.downSince = Date.now();
      await this.send(`🔴 ${this.name}: не работает${detail ? ` — ${detail}` : ''}`);
    }
  }
}

async function probe(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'denvise-monitor' } });
    return { ok: res.ok, detail: res.ok ? '' : `ответ ${res.status}` };
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'TimeoutError';
    return { ok: false, detail: timeout ? 'нет ответа за 10 с' : 'нет соединения' };
  }
}

// Ошибки модели подряд (кончились деньги на ключе, OpenRouter недоступен…)
const llmWatch = new Watch('Модель (OpenRouter)', LLM_FAILS_BEFORE_ALERT);
export function reportLlm(ok: boolean) {
  llmWatch.report(ok, 'несколько запросов подряд с ошибкой').catch(() => {});
}

// Остаток лимита на ключе OpenRouter
let creditLow = false;
async function checkCredit() {
  const key = process.env.OPENROUTER_API_KEY?.replace(/\s+/g, '');
  if (!key) return;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const d = ((await res.json()) as { data?: { limit?: number; limit_remaining?: number } })?.data;
    if (typeof d?.limit !== 'number' || d.limit <= 0 || typeof d.limit_remaining !== 'number') return;
    const share = d.limit_remaining / d.limit;
    if (share < CREDIT_LOW_SHARE && !creditLow) {
      creditLow = true;
      await notify(`🟠 OpenRouter: на ключе осталось $${d.limit_remaining.toFixed(2)} из $${d.limit} — пополните или поднимите лимит`);
    } else if (share >= CREDIT_LOW_SHARE) {
      creditLow = false;
    }
  } catch {
    // нет связи с OpenRouter — это заметит проверка ответов модели
  }
}

export function startMonitor() {
  if (!monitorEnabled) {
    console.log('[monitor] выключен (нет TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
    return;
  }
  const watches = TARGETS.map(([name, url]) => ({ url, watch: new Watch(name, FAILS_BEFORE_ALERT) }));
  const tick = () => {
    for (const { url, watch } of watches) probe(url).then((r) => watch.report(r.ok, r.detail)).catch(() => {});
  };
  setInterval(tick, CHECK_EVERY_MS).unref();
  setTimeout(tick, 15_000).unref();
  setInterval(checkCredit, CREDIT_EVERY_MS).unref();
  checkCredit();
  console.log(`[monitor] включён: ${TARGETS.map(([n]) => n).join(', ')}`);
  notify('ℹ️ Шлюз Denvise запущен, мониторинг включён');
}
