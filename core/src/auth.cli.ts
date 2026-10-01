// Только для генератора схемы Better Auth (npm run auth:schema): он
// импортирует этот файл и читает конфигурацию. Соединение с базой не
// открывается — пул подключается лишь при первом запросе.
import { createAuth } from './auth.js';
import { createDb } from './db/index.js';
import { loadEnv } from './env.js';

const env = loadEnv({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://schema-only@localhost:1/none',
  BETTER_AUTH_SECRET: 'schema-generation-only-secret-000000000000',
  BETTER_AUTH_URL: 'http://localhost:8788',
});

export const auth = createAuth(env, createDb(env.DATABASE_URL).db);
