import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CORE_URL } from '../constants/config';
import { isStandalone, setAnalyticsUser, track } from './analytics';

// Состояние приложения на верхнем уровне: пройден ли онбординг и выполнен ли
// вход. От него зависит, какой экран показать: онбординг → вход → приложение
// (см. app/_layout.tsx). Вход работает только если задан адрес ядра (CORE_URL).

/** Тариф: бесплатный или Pro до указанного момента (ISO). */
export type Access = { plan: 'free' | 'pro'; proUntil: string | null };

/** Кто пользователь (экран «Расскажите о себе»). */
export type Profile = {
  firstName: string;
  lastName: string | null;
  role: 'student' | 'graduate' | 'resident' | 'doctor' | 'assistant' | 'other';
  course: number | null;
  university: string | null;
};

export type User = { id: string; email: string; name: string; access?: Access; profile?: Profile | null };

const ONBOARDED_KEY = 'denvise_onboarded';
// Последний известный пользователь — чтобы без сети приложение открывалось
// у того, кто уже входил (бесплатный контент доступен офлайн)
const USER_KEY = 'denvise_user';

export const authEnabled = CORE_URL !== '';

type Session = {
  loading: boolean;
  onboarded: boolean;
  user: User | null;
  completeOnboarding: () => Promise<void>;
  /** Отправить код на почту. */
  requestCode: (email: string) => Promise<void>;
  /** Войти по коду из письма. */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Активировать промокод — даёт Pro на срок кода. */
  redeemPromo: (code: string) => Promise<Access>;
  /** Сохранить профиль (имя, роль, курс, вуз). */
  saveProfile: (p: Profile) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession вне SessionProvider');
  return s;
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

// Понятные сообщения для кодов ошибок Better Auth
const MESSAGES: Record<string, string> = {
  INVALID_OTP: 'Неверный код. Проверьте цифры из письма.',
  OTP_EXPIRED: 'Код устарел. Запросите новый.',
  TOO_MANY_ATTEMPTS: 'Слишком много неверных попыток. Запросите новый код.',
  INVALID_EMAIL: 'Проверьте адрес почты.',
  RATE_LIMITED: 'Слишком часто. Подождите минуту и попробуйте снова.',
  NETWORK: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
};

async function core<T>(path: string, body?: unknown, method?: 'PUT'): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CORE_URL}${path}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError('NETWORK', MESSAGES.NETWORK!);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = res.status === 429 ? 'RATE_LIMITED' : (data?.code as string) || `HTTP_${res.status}`;
    // Ошибки самого ядра (не входа) приходят готовым текстом в поле error
    const own = typeof data?.error === 'string' ? (data.error as string) : null;
    throw new AuthError(code, own || MESSAGES[code] || 'Что-то пошло не так. Попробуйте ещё раз.');
  }
  return data as T;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const remember = useCallback(async (u: User | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(USER_KEY);
  }, []);

  // Аналитика знает, кто вошёл (для привязки источника прихода)
  useEffect(() => setAnalyticsUser(user?.id ?? null), [user?.id]);

  useEffect(() => {
    track('app_open', { standalone: isStandalone() });
    (async () => {
      const [ob, cached] = await Promise.all([AsyncStorage.getItem(ONBOARDED_KEY), AsyncStorage.getItem(USER_KEY)]);
      setOnboarded(!!ob);
      if (!authEnabled) {
        setLoading(false);
        return;
      }
      const check = async () => {
        try {
          const me = await core<{ user: User }>('/api/me');
          await remember(me.user);
        } catch (e) {
          // 401 — вход действительно нужен. Нет сети или сбой сервера — остаёмся
          // в аккаунте по последнему известному входу
          if (e instanceof AuthError && e.code === 'HTTP_401') await remember(null);
        }
      };
      if (cached) {
        // Уже входили на этом устройстве — открываемся сразу, вход проверяем в фоне.
        // Иначе без сети на iPhone запрос висит до тайм-аута, а приложение — на заставке
        setUser(JSON.parse(cached));
        setLoading(false);
        void check();
      } else {
        await check();
        setLoading(false);
      }
    })();
  }, [remember]);

  const value = useMemo<Session>(
    () => ({
      loading,
      onboarded,
      user,
      async completeOnboarding() {
        await AsyncStorage.setItem(ONBOARDED_KEY, '1');
        setOnboarded(true);
        track('onboarding_done');
      },
      async requestCode(email) {
        await core('/api/auth/email-otp/send-verification-otp', { email: email.trim().toLowerCase(), type: 'sign-in' });
        track('code_requested');
      },
      async verifyCode(email, code) {
        await core('/api/auth/sign-in/email-otp', { email: email.trim().toLowerCase(), otp: code });
        const me = await core<{ user: User }>('/api/me');
        await remember(me.user);
        track('signed_in', { newUser: !me.user.profile });
      },
      async signOut() {
        await core('/api/auth/sign-out', {}).catch(() => {});
        await remember(null);
      },
      async saveProfile(p) {
        const { profile } = await core<{ profile: Profile }>('/api/profile', p, 'PUT');
        if (user) await remember({ ...user, profile });
        track('profile_saved', { role: profile.role });
      },
      async redeemPromo(code) {
        const { access } = await core<{ access: Access }>('/api/promo/redeem', { code });
        if (user) await remember({ ...user, access });
        track('promo_redeemed');
        return access;
      },
    }),
    [loading, onboarded, user, remember]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
