import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Каждый тестовый файл поднимает свой PostgreSQL — даём время на старт
    hookTimeout: 120_000,
    testTimeout: 30_000,
    env: { TZ: 'UTC', NODE_ENV: 'test' },
    fileParallelism: false,
  },
});
