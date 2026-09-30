import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

// Готово ли веб-приложение запускаться без интернета (см. public/sw.js).
// Показывается в Профиле, чтобы на телефоне было видно, чего не хватает.
// null — не веб или проверка ещё идёт.
export function useOfflineStatus(): string | null {
  const [status, setStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      let cancelled = false;
      check().then((s) => {
        if (!cancelled) setStatus(s);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return status;
}

/** Короткий номер сборки — начало хеша бандла, чтобы видеть, какая версия открыта. */
function buildId(): string {
  const src = document.querySelector<HTMLScriptElement>('script[src*="/entry-"]')?.src ?? '';
  const m = src.match(/entry-([a-f0-9]{6})/);
  return m ? `, сборка ${m[1]}` : '';
}

async function check(): Promise<string> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'не поддерживается';
  if (!navigator.serviceWorker.controller) return 'не готово: перезапустите приложение с интернетом';
  try {
    const name = (await caches.keys()).find((k) => k.startsWith('denvise-'));
    if (!name) return 'не готово: нет кеша';
    const paths = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    const missing: string[] = [];
    if (!paths.includes('/')) missing.push('страница');
    if (!paths.some((p) => p.includes('/_expo/static/js/'))) missing.push('код');
    if (!paths.some((p) => p.endsWith('.ttf'))) missing.push('иконки');
    const ver = `${name.replace('denvise-', '')}${buildId()}`;
    return missing.length ? `не готово: нет — ${missing.join(', ')} (${ver})` : `готово (${ver})`;
  } catch {
    return 'не готово: кеш недоступен';
  }
}
