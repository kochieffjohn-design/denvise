import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { Db } from './db/index.js';
import * as schema from './db/schema.js';
import { otpEmail, sendEmail } from './email.js';
import { type Env, webOrigins } from './env.js';

const DAY = 60 * 60 * 24;

// Вход без паролей. Сейчас — код на email; Яндекс ID, VK ID и Telegram
// добавляются следующими шагами (MIGRATION-WEB.md §3).
export function createAuth(env: Env, db: Db) {
  return betterAuth({
    appName: 'Denvise',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: webOrigins(env),
    database: drizzleAdapter(db, { provider: 'pg', schema }),

    emailAndPassword: { enabled: false },

    session: {
      // 90 дней, продлевается при каждом заходе (не чаще раза в сутки):
      // кто пользуется регулярно — не выходит никогда
      expiresIn: 90 * DAY,
      updateAge: DAY,
    },

    user: {
      deleteUser: {
        enabled: true,
        // Удаление всегда подтверждается ссылкой из письма — случайно (или
        // с чужого разблокированного телефона) аккаунт не удалить
        sendDeleteAccountVerification: async ({ user, url }) => {
          void sendEmail({
            to: user.email,
            subject: 'Подтвердите удаление аккаунта Denvise',
            text: [
              'Вы запросили удаление аккаунта Denvise. Прогресс и данные профиля будут удалены без возможности восстановления.',
              '',
              `Подтвердить удаление: ${url}`,
              '',
              'Если вы этого не делали — просто проигнорируйте письмо, аккаунт останется.',
            ].join('\n'),
          });
        },
      },
    },

    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        // Не ждём отправку письма: время ответа не должно выдавать, есть ли такой email
        async sendVerificationOTP({ email, otp }) {
          void sendEmail({ to: email, ...otpEmail(otp) });
        },
      }),
    ],

    rateLimit: {
      enabled: env.NODE_ENV !== 'test',
      window: 60,
      max: 100,
      customRules: {
        // Не больше 3 писем с кодом в минуту с одного адреса
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },

    advanced: {
      // Проверка Origin против подделки запросов — всегда. Под тестами Better
      // Auth по умолчанию её выключает, а тесты должны проверять боевое поведение
      disableOriginCheck: false,
      // IP пользователя для лимитов (3 письма в минуту и т.п.). Ядро доступно
      // только через Caddy, который сам выставляет X-Forwarded-For и не
      // принимает этот заголовок от клиентов — поэтому ему можно доверять.
      // Без этого лимит был бы один общий на всех пользователей.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
      cookiePrefix: 'denvise',
      useSecureCookies: env.NODE_ENV === 'production',
      // Сайт (denvise.ru) и ядро (api.denvise.ru) — один сайт для браузера:
      // cookie на общий домен, без сторонних cookie и проблем с Safari ITP
      crossSubDomainCookies: env.COOKIE_DOMAIN ? { enabled: true, domain: env.COOKIE_DOMAIN } : undefined,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
