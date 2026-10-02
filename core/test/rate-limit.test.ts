import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestCore, WEB } from './helpers.js';

// Лимиты включены (в обычных тестах они выключены): письма с кодом — не больше
// 3 в минуту с одного IP. IP берётся из X-Forwarded-For, который ставит Caddy.

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore({ nodeEnv: 'development' });
});
afterAll(async () => {
  await core?.stop();
});

const requestCode = (ip: string, email: string) =>
  core.app.request('/api/auth/email-otp/send-verification-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: WEB, 'X-Forwarded-For': ip },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });

describe('лимит писем с кодом', () => {
  it('4-й запрос за минуту с одного IP — 429, с другого IP — проходит', async () => {
    for (let i = 0; i < 3; i++) expect((await requestCode('203.0.113.7', `a${i}@example.com`)).status).toBe(200);
    expect((await requestCode('203.0.113.7', 'a3@example.com')).status).toBe(429);
    // Другой пользователь из другой сети лимитом первого не задет
    expect((await requestCode('198.51.100.9', 'b@example.com')).status).toBe(200);
  });
});
