import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { createAuth } from '../src/auth.js';
import { createDb, runMigrations } from '../src/db/index.js';
import { loadEnv } from '../src/env.js';

export const WEB = 'http://localhost:8081';

/** Настоящий PostgreSQL во временной папке + ядро поверх него. */
export async function startTestCore({
  nodeEnv = 'test',
  gatewayFetch,
}: { nodeEnv?: 'test' | 'development'; gatewayFetch?: typeof fetch } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'denvise-core-test-'));
  const port = 55000 + Math.floor(Math.random() * 2000);
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('core');

  const env = loadEnv({
    NODE_ENV: nodeEnv,
    DATABASE_URL: `postgres://test:test@localhost:${port}/core`,
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
    BETTER_AUTH_URL: 'http://localhost:8788',
    WEB_ORIGINS: WEB,
    GATEWAY_URL: 'https://gateway.test',
    GATEWAY_KEY: 'test-gateway-key-test-gateway-key-00',
  });
  const { db, pool } = createDb(env.DATABASE_URL);
  await runMigrations(db);
  const app = createApp({ env, auth: createAuth(env, db), db, gatewayFetch });

  return {
    app,
    db,
    pool,
    async stop() {
      await pool.end();
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Браузер в миниатюре: хранит cookie между запросами и шлёт Origin сайта. */
export function client(app: { request: (path: string, init?: RequestInit) => Response | Promise<Response> }) {
  const jar = new Map<string, string>();
  const send = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has('Origin')) headers.set('Origin', WEB);
    if (jar.size) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    let body = init.body;
    if (init.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(init.json);
    }
    const res = await app.request(path, { ...init, headers, body });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      const value = rest.join('=');
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim())) || value === '';
      if (name) expired ? jar.delete(name.trim()) : jar.set(name.trim(), value);
    }
    return res;
  };
  return { send, jar };
}
