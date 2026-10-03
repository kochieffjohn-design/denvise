import { z } from 'zod';

// Настройки ядра — из переменных окружения. Проверяем при старте: ошибка
// конфигурации должна ронять процесс сразу, а не на первом запросе.

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8788),
  DATABASE_URL: z.string().min(1),
  // Ключ подписи сессий (≥ 32 символа). В проде — из секретов Yandex Cloud.
  BETTER_AUTH_SECRET: z.string().min(32),
  // Публичный адрес ядра, например https://api.denvise.ru
  BETTER_AUTH_URL: z.string().url(),
  // Откуда разрешены запросы с cookie (адреса сайта), через запятую
  WEB_ORIGINS: z.string().default('http://localhost:8081'),
  // Общий домен для cookie сайта и ядра в проде: denvise.ru
  COOKIE_DOMAIN: z.string().optional(),
  // Как отправлять письма: console (разработка) или postbox (прод)
  EMAIL_TRANSPORT: z.enum(['console', 'postbox']).default('console'),
  EMAIL_FROM: z.string().default('Denvise <noreply@denvise.ru>'),
  // LLM-шлюз ДентИИ и ИИ-Пациента (Railway, за рубежом) и секретный ключ ядра для него
  GATEWAY_URL: z.string().url().default('http://localhost:8787'),
  GATEWAY_KEY: z.string().min(32).optional(),
  // Куда слать тревоги мониторинга, если недоступен шлюз (и с ним Telegram). Задан — мониторинг включён
  ALERT_EMAIL: z.string().email().optional(),
})
  // В проде письма с кодом входа обязаны реально уходить
  .refine((e) => e.NODE_ENV !== 'production' || e.EMAIL_TRANSPORT === 'postbox', {
    message: 'в production нужен EMAIL_TRANSPORT=postbox',
    path: ['EMAIL_TRANSPORT'],
  })
  // В проде ядро ходит в настоящий шлюз и представляется ему ключом
  .refine((e) => e.NODE_ENV !== 'production' || (!!e.GATEWAY_KEY && !e.GATEWAY_URL.includes('localhost')), {
    message: 'в production нужны GATEWAY_URL шлюза и GATEWAY_KEY',
    path: ['GATEWAY_KEY'],
  });

export type Env = z.infer<typeof Env>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Неверные настройки ядра:\n${problems}`);
  }
  return parsed.data;
}

export const webOrigins = (env: Env) => env.WEB_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
