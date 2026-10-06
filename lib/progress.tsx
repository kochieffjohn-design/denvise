import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { CORE_URL } from '../constants/config';
import { track } from './analytics';
import { authEnabled, useSession } from './session';

// Прогресс: пройденные задания, опыт, серия дней подряд.
//
// Со входом прогресс хранится в аккаунте (ядро). Завершённое задание сразу
// попадает в локальную очередь и показывается, а в ядро уходит, как только
// есть связь, — без сети ничего не теряется. Ядро возвращает итог, он и
// становится основой. У каждого аккаунта на устройстве своя запись.
// Без ядра (локальная разработка) прогресс хранится только на устройстве.

export type ProgressKind = 'diag' | 'comm' | 'exam' | 'patient' | 'station';

type ProgressEvent = { id: string; kind: ProgressKind; itemId: string | null; xp: number; localDate: string; at: number };

type Summary = {
  xp: number;
  counts: Record<ProgressKind, number>;
  diagDone: string[];
  activeDates: string[]; // по часам пользователя, от свежих к старым
};

type Stored = { base: Summary; outbox: ProgressEvent[] };

export type Stats = {
  xp: number;
  diagCases: number;
  commScenarios: number; // сценарии коммуникации и приёмы ИИ-Пациента
  exams: number;
  streak: number;
  diagDone: string[];
};

const EMPTY: Summary = { xp: 0, counts: { diag: 0, comm: 0, exam: 0, patient: 0, station: 0 }, diagDone: [], activeDates: [] };
const storageKey = (userId: string | null) => `denvise_progress:${userId ?? 'local'}`;
// Прогресс до появления аккаунтов (только на устройстве) — больше не нужен
const LEGACY_KEYS = ['denvise_stats_v2', 'denvise_diag_done'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Добавить записи к итогу — так же, как считает ядро. */
function fold(base: Summary, events: ProgressEvent[]): Summary {
  if (!events.length) return base;
  const counts = { ...base.counts };
  const diag = new Set(base.diagDone);
  const dates = new Set(base.activeDates);
  let xp = base.xp;
  for (const e of events) {
    xp += e.xp;
    counts[e.kind] = (counts[e.kind] ?? 0) + 1; // в старом кеше может не быть нового вида
    if (e.kind === 'diag' && e.itemId) diag.add(e.itemId);
    dates.add(e.localDate);
  }
  return { xp, counts, diagDone: [...diag].sort(), activeDates: [...dates].sort().reverse() };
}

/** Дней подряд с активностью, считая сегодня (или вчера — если сегодня ещё не занимались). */
function streakOf(activeDates: string[], now = new Date()): number {
  const days = new Set(activeDates);
  const d = new Date(now);
  if (!days.has(dateStr(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dateStr(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

function toStats(s: Summary): Stats {
  return {
    xp: s.xp,
    diagCases: s.counts.diag,
    commScenarios: s.counts.comm + s.counts.patient,
    exams: s.counts.exam,
    streak: streakOf(s.activeDates),
    diagDone: s.diagDone,
  };
}

async function coreRequest(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<Summary> {
  const res = await fetch(CORE_URL + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`progress ${method} ${res.status}`);
  return (await res.json()) as Summary;
}

type Progress = {
  stats: Stats;
  /** Задание завершено. Возвращает обновлённую статистику. */
  record: (kind: ProgressKind, itemId: string | null, xp: number) => Stats;
  /** Сбросить весь прогресс (со входом — и в аккаунте). */
  reset: () => Promise<void>;
};

const ProgressContext = createContext<Progress | null>(null);

export function useProgress(): Progress {
  const p = useContext(ProgressContext);
  if (!p) throw new Error('useProgress вне ProgressProvider');
  return p;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = authEnabled ? (user?.id ?? null) : null;
  const synced = authEnabled && !!userId; // прогресс живёт в аккаунте
  const key = storageKey(userId);

  const [stored, setStored] = useState<Stored>({ base: EMPTY, outbox: [] });
  const ref = useRef(stored); // актуальное значение для асинхронной синхронизации
  const keyRef = useRef(key);
  const syncing = useRef(false);
  const again = useRef(false);

  const save = useCallback((next: Stored) => {
    ref.current = next;
    setStored(next);
    AsyncStorage.setItem(keyRef.current, JSON.stringify(next)).catch(() => {});
  }, []);

  /** Отправить очередь в ядро и взять оттуда итог. Без сети — тихо ждём следующего раза. */
  const sync = useCallback(async () => {
    if (!synced) return;
    if (syncing.current) {
      again.current = true;
      return;
    }
    syncing.current = true;
    const forKey = keyRef.current;
    try {
      do {
        again.current = false;
        const sent = ref.current.outbox.slice(0, 100);
        const base = sent.length
          ? await coreRequest('POST', '/api/progress/events', { events: sent })
          : await coreRequest('GET', '/api/progress');
        if (keyRef.current !== forKey) return; // за это время сменился аккаунт
        const sentIds = new Set(sent.map((e) => e.id));
        save({ base, outbox: ref.current.outbox.filter((e) => !sentIds.has(e.id)) });
        if (ref.current.outbox.length) again.current = true;
      } while (again.current);
    } catch {
      // нет сети или сессия истекла — очередь сохранена, отправим позже
    } finally {
      syncing.current = false;
    }
  }, [synced, save]);

  // Загрузка своей записи при запуске и при смене аккаунта
  useEffect(() => {
    keyRef.current = key;
    let cancelled = false;
    AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        const loaded: Stored = raw ? JSON.parse(raw) : { base: EMPTY, outbox: [] };
        ref.current = loaded;
        setStored(loaded);
        sync();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, sync]);

  // Связь вернулась / приложение снова на экране — отправляем накопленное
  useEffect(() => {
    if (!synced) return;
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    const online = () => sync();
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', online);
    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', online);
    };
  }, [synced, sync]);

  const record = useCallback(
    (kind: ProgressKind, itemId: string | null, xp: number): Stats => {
      const now = new Date();
      const e: ProgressEvent = {
        id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        kind,
        itemId,
        xp: Math.max(0, Math.round(xp)),
        localDate: dateStr(now),
        at: now.getTime(),
      };
      const cur = ref.current;
      const next: Stored = synced ? { base: cur.base, outbox: [...cur.outbox, e] } : { base: fold(cur.base, [e]), outbox: [] };
      save(next);
      if (synced) sync();
      track('task_done', { kind, item: itemId });
      return toStats(fold(next.base, next.outbox));
    },
    [synced, save, sync]
  );

  const reset = useCallback(async () => {
    if (synced) {
      const base = await coreRequest('DELETE', '/api/progress'); // без сети — ошибка, показывает экран
      save({ base, outbox: [] });
    } else {
      save({ base: EMPTY, outbox: [] });
    }
  }, [synced, save]);

  const stats = useMemo(() => toStats(fold(stored.base, stored.outbox)), [stored]);
  const value = useMemo(() => ({ stats, record, reset }), [stats, record, reset]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}
