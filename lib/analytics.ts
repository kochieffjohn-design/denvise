import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { CORE_URL } from '../constants/config';

// Аналитика без сторонних счётчиков: события копятся и пачкой уходят в ядро
// (core/src/analytics.ts). До входа событие знает только anonId устройства,
// после — ядро само привязывает его к пользователю по cookie сессии.

export type EventName =
  | 'app_open'
  | 'onboarding_done'
  | 'code_requested'
  | 'signed_in'
  | 'profile_saved'
  | 'task_done'
  | 'pro_lock_tap'
  | 'promo_redeemed'
  | 'limit_hit';

type Props = Record<string, string | number | boolean | null>;
type Acquisition = { ref?: string; source?: string; medium?: string; campaign?: string; landing?: string; firstSeenAt?: number };

const enabled = CORE_URL !== '';
const ANON_KEY = 'denvise_anon_id';
const ACQ_KEY = 'denvise_acq'; // первая метка: откуда пришёл
const ACQ_SENT_KEY = 'denvise_acq_sent'; // для каких аккаунтов уже отправили

let anonId: string | null = null;
let userId: string | null = null;
let queue: { name: EventName; props?: Props; at: number }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    anonId = (await AsyncStorage.getItem(ANON_KEY)) || randomId();
    await AsyncStorage.setItem(ANON_KEY, anonId);
  } catch {
    anonId = anonId || randomId();
  }
  return anonId;
}

/** Метки из ссылки (?ref=… / utm_…) запоминаются при самом первом заходе. */
async function captureAcquisition() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (await AsyncStorage.getItem(ACQ_KEY)) return;
    const q = new URLSearchParams(window.location.search);
    const acq: Acquisition = {
      ref: q.get('ref') || undefined,
      source: q.get('utm_source') || undefined,
      medium: q.get('utm_medium') || undefined,
      campaign: q.get('utm_campaign') || undefined,
      landing: (window.location.pathname + window.location.search).slice(0, 300),
      firstSeenAt: Date.now(),
    };
    await AsyncStorage.setItem(ACQ_KEY, JSON.stringify(acq));
  } catch {}
}
if (enabled) void captureAcquisition();

/** Сессия знает, кто вошёл: после входа метку источника отправим один раз для аккаунта. */
export function setAnalyticsUser(id: string | null) {
  userId = id;
  if (id) schedule(0);
}

export function track(name: EventName, props?: Props) {
  if (!enabled) return;
  queue.push({ name, props, at: Date.now() });
  schedule(2000);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

async function flush(keepalive = false) {
  timer = null;
  if (!enabled) return;
  let acquisition: Acquisition | undefined;
  let acqFor: string | null = null;
  try {
    if (userId) {
      const sent: string[] = JSON.parse((await AsyncStorage.getItem(ACQ_SENT_KEY)) || '[]');
      if (!sent.includes(userId)) {
        acquisition = JSON.parse((await AsyncStorage.getItem(ACQ_KEY)) || 'null') ?? undefined;
        acqFor = userId;
      }
    }
  } catch {}
  if (!queue.length && !acquisition) return;
  const events = queue.splice(0, 50);
  try {
    const res = await fetch(`${CORE_URL}/api/events`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId: await getAnonId(), events, acquisition }),
      keepalive,
    });
    if (res.ok && acqFor) {
      const sent: string[] = JSON.parse((await AsyncStorage.getItem(ACQ_SENT_KEY)) || '[]');
      await AsyncStorage.setItem(ACQ_SENT_KEY, JSON.stringify([...sent, acqFor]));
    }
    if (queue.length) schedule(1000);
  } catch {
    // нет сети — события не критичны, вернём в очередь (не больше 200)
    queue = [...events, ...queue].slice(-200);
  }
}

// Уходят со страницы — отправляем накопленное сразу
if (enabled && Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length) void flush(true);
  });
}

/** Открыто как установленное приложение (иконка на экране «Домой»)? */
export function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}
