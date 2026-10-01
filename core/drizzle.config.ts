import { defineConfig } from 'drizzle-kit';

// Генерация миграций: npm run db:generate (база для этого не нужна)
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
