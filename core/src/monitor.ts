import { statfs } from 'node:fs/promises';
import { onEmailFailure, sendEmail } from './email.js';

// Мониторинг боевого ядра. Тревоги владельцу идут в Telegram через шлюз
// (из Yandex Cloud Telegram недоступен); если не отвечает сам шлюз —
// письмом на ALERT_EMAIL через Postbox. За самим ядром и сайтом снаружи
// следит шлюз (server/src/monitor.ts).

const CHECK_EVERY_MS = 60_000;
const GATEWAY_FAILS_BEFORE_ALERT = 3;
const DISK_LOW_SHARE = 0.1; // тревога, когда свободно меньше 10%
const DISK_OK_SHARE = 0.15;
// Одна и та же тревога — не чаще раза в 30 минут
const REPEAT_AFTER_MS = 30 * 60_000;

export type MonitorDeps = {
  gatewayUrl: string;
  gatewayKey?: string;
  alertEmail: string;
  fetchImpl?: typeof fetch;
  diskFreeShare?: () => Promise<number>;
  now?: () => number;
};

async function rootDiskFreeShare(): Promise<number> {
  const s = await statfs('/');
  return s.bavail / s.blocks;
}

export function createMonitor(deps: MonitorDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const diskFree = deps.diskFreeShare ?? rootDiskFreeShare;
  const lastSent = new Map<string, number>();

  async function viaGateway(text: string): Promise<boolean> {
    try {
      const res = await fetchImpl(deps.gatewayUrl.replace(/\/$/, '') + '/internal/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(deps.gatewayKey ? { 'X-Gateway-Key': deps.gatewayKey } : {}) },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function viaEmail(text: string): Promise<boolean> {
    return sendEmail({ to: deps.alertEmail, subject: `Denvise: ${text.slice(0, 80)}`, text }, fetchImpl, { silent: true });
  }

  /** Тревога владельцу. key — для подавления повторов (по умолчанию сам текст). */
  async function alert(text: string, { key = text, emailFirst = false } = {}): Promise<void> {
    const t = now();
    const prev = lastSent.get(key);
    if (prev !== undefined && t - prev < REPEAT_AFTER_MS) return;
    lastSent.set(key, t);
    console.warn(`[monitor] ${text}`);
    const sent = emailFirst ? await viaEmail(text) : (await viaGateway(text)) || (await viaEmail(text));
    if (!sent) console.error('[monitor] тревогу не удалось отправить ни в Telegram, ни письмом');
  }

  let gatewayFails = 0;
  let gatewayDown = false;
  let gatewayDownSince = 0;
  async function checkGateway() {
    let ok = false;
    try {
      ok = (await fetchImpl(deps.gatewayUrl.replace(/\/$/, '') + '/health', { signal: AbortSignal.timeout(10_000) })).ok;
    } catch {
      ok = false;
    }
    if (ok) {
      gatewayFails = 0;
      if (gatewayDown) {
        gatewayDown = false;
        const mins = Math.max(1, Math.round((now() - gatewayDownSince) / 60_000));
        lastSent.delete('gateway');
        await alert(`✅ Шлюз ДентИИ снова доступен (не было ~${mins} мин)`, { key: 'gateway-up' });
      }
      return;
    }
    gatewayFails++;
    if (gatewayFails === GATEWAY_FAILS_BEFORE_ALERT) {
      gatewayDown = true;
      gatewayDownSince = now();
      lastSent.delete('gateway-up');
      // Шлюз и есть дорога в Telegram — сразу письмом
      await alert('🔴 Шлюз ДентИИ (Railway) недоступен из Yandex Cloud: ДентИИ и ИИ-Пациент не отвечают', {
        key: 'gateway',
        emailFirst: true,
      });
    }
  }

  let diskLow = false;
  async function checkDisk() {
    try {
      const share = await diskFree();
      if (share < DISK_LOW_SHARE && !diskLow) {
        diskLow = true;
        await alert(`🟠 На машине ядра заканчивается место: свободно ${Math.round(share * 100)}%`, { key: 'disk' });
      } else if (share >= DISK_OK_SHARE) {
        diskLow = false;
      }
    } catch {
      // не смогли узнать — не повод для тревоги
    }
  }

  async function tick() {
    await Promise.all([checkGateway(), checkDisk()]);
  }

  let timer: NodeJS.Timeout | null = null;
  return {
    alert,
    tick,
    start() {
      onEmailFailure((reason) => {
        void alert(`🔴 Не отправляются письма с кодом входа (Postbox): ${reason.slice(0, 200)}`, { key: 'email' });
      });
      timer = setInterval(() => void tick(), CHECK_EVERY_MS);
      timer.unref();
      console.log('[monitor] включён');
    },
    stop() {
      if (timer) clearInterval(timer);
      onEmailFailure(null);
    },
  };
}
