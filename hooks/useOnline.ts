import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Есть ли интернет (по данным браузера). На native без NetInfo всегда true —
 * там об отсутствии сети скажет ошибка запроса.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
