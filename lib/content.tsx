import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import { CORE_URL } from '../constants/config';
import type { Section } from '../data/consultData';
import { track } from './analytics';
import { authEnabled, useSession, type Access } from './session';

// Pro-контент: кейсы, которых нет в приложении. С Pro загружается из ядра
// и хранится на устройстве (работает без сети); обновляется, когда в ядре
// меняется версия. Без Pro — только названия (data/proCatalog.ts) с замком.

export type ProContent = {
  diag: any[];
  comm: any[];
  consult: Section[];
  procedures: any[];
};

type Stored = { version: string; content: ProContent };

type ProState = {
  /** Есть Pro прямо сейчас (по последним известным данным аккаунта). */
  isPro: boolean;
  /** Pro-контент, если загружен (или сохранён раньше). */
  content: ProContent | null;
  /** Pro есть, но контент ещё не загружен (первый раз нужен интернет). */
  loading: boolean;
};

const CACHE_KEY = 'denvise_pro_content';

export function hasPro(access: Access | undefined, now = Date.now()): boolean {
  return access?.plan === 'pro' && !!access.proUntil && Date.parse(access.proUntil) > now;
}

const ProContext = createContext<ProState>({ isPro: false, content: null, loading: false });
export const useProContent = () => useContext(ProContext);

export function ProContentProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const isPro = authEnabled && hasPro(user?.access);
  const [stored, setStored] = useState<Stored | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Пока аккаунт загружается, Pro ещё неизвестен — ничего не трогаем,
    // иначе сохранённые для работы без сети Pro-кейсы удалились бы при каждом запуске
    if (sessionLoading) return;
    if (!isPro) {
      // Pro закончился или вышли из аккаунта — Pro-контент на устройстве не храним
      setStored(null);
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      return;
    }
    (async () => {
      setLoading(true);
      let cached: Stored | null = null;
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        cached = raw ? JSON.parse(raw) : null;
        if (cached && !cancelled) setStored(cached);
      } catch {}
      try {
        const res = await fetch(`${CORE_URL}/api/content/pro`, {
          credentials: 'include',
          headers: cached ? { 'If-None-Match': `"${cached.version}"` } : undefined,
          signal: AbortSignal.timeout(20000),
        });
        if (res.status === 200) {
          const version = (res.headers.get('etag') ?? '').replace(/"/g, '');
          const next: Stored = { version, content: await res.json() };
          if (!cancelled) setStored(next);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } else if (res.status === 403) {
          if (!cancelled) setStored(null);
          await AsyncStorage.removeItem(CACHE_KEY);
        }
      } catch {
        // нет сети — работаем с сохранённой версией
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionLoading, isPro, user?.id]);

  const value = useMemo(() => ({ isPro, content: isPro ? (stored?.content ?? null) : null, loading }), [isPro, stored, loading]);
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

/**
 * Нажали на карточку с замком. С Pro, но контент ещё не загружен — объясняем,
 * что нужен интернет; без Pro — предлагаем промокод в Профиле.
 */
export function onLockedPress(state: ProState, openProfile: () => void, section = '') {
  track('pro_lock_tap', { section, isPro: state.isPro });
  if (state.isPro) {
    const text = state.loading ? 'Загружаем Pro-кейсы, это займёт несколько секунд.' : 'Чтобы загрузить Pro-кейсы, подключитесь к интернету.';
    if (Platform.OS === 'web') window.alert(text);
    else Alert.alert('Pro', text);
    return;
  }
  const title = 'Доступно в Pro';
  const message = 'Этот кейс входит в Pro. Если у вас есть промокод, введите его в Профиле.';
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}\n\nОткрыть Профиль?`)) openProfile();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Закрыть', style: 'cancel' },
    { text: 'В Профиль', onPress: openProfile },
  ]);
}
