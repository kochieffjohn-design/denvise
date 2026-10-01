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
