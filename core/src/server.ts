// Точка входа в проде (npm start). Локально — scripts/dev.ts.
import { start } from './index.js';

const core = await start().catch((e) => {
  console.error(e);
  process.exit(1);
});

const shutdown = async () => {
  await core.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
