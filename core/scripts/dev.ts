// Локальный запуск ядра: поднимает настоящий PostgreSQL 18 в папке
// core/.pgdata (без установки в систему), затем само ядро.
// Письма с кодом входа печатаются в консоль.
process.env.TZ = 'UTC';

import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../.pgdata', import.meta.url));
const PG_PORT = 54329;

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'denvise',
  password: 'denvise',
  port: PG_PORT,
  persistent: true,
  onLog: () => {},
});

if (!existsSync(dataDir)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase('denvise');
} catch {
  // уже создана
}

process.env.NODE_ENV ??= 'development';
process.env.DATABASE_URL = `postgres://denvise:denvise@localhost:${PG_PORT}/denvise`;
process.env.BETTER_AUTH_SECRET ??= 'local-development-secret-not-for-production-000';
process.env.BETTER_AUTH_URL ??= 'http://localhost:8788';
process.env.WEB_ORIGINS ??= 'http://localhost:8081';

const { start } = await import('../src/index.js');
const core = await start();

const shutdown = async () => {
  await core.stop();
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
