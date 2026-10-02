// Время в базе хранится без часового пояса — ядро работает строго в UTC,
// иначе на машине с другим поясом сроки сессий и кодов съедут.
process.env.TZ = 'UTC';

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { createDb, runMigrations } from './db/index.js';
import { configureEmail } from './email.js';
import { loadEnv } from './env.js';

export async function start() {
  const env = loadEnv();
  configureEmail({ transport: env.EMAIL_TRANSPORT, from: env.EMAIL_FROM });
  const { db, pool } = createDb(env.DATABASE_URL);
  await runMigrations(db);
  const app = createApp({ env, auth: createAuth(env, db), db });
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`Ядро Denvise: http://localhost:${info.port} (${env.NODE_ENV})`);
  });
  const stop = async () => {
    server.close();
    await pool.end();
  };
  return { stop };
}
