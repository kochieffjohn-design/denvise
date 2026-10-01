import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { session, user } from '../src/db/schema.js';
import { sentEmails } from '../src/email.js';
import { client, startTestCore, WEB } from './helpers.js';

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore();
});
afterAll(async () => {
  await core?.stop();
});
beforeEach(() => {
  sentEmails.length = 0;
});

const lastCode = (to: string) => {
  const mail = [...sentEmails].reverse().find((m) => m.to === to);
  return mail?.text.match(/\b(\d{6})\b/)?.[1];
};

/** Полный вход по коду из письма; возвращает клиента с cookie сессии. */
async function signIn(email: string) {
  const c = client(core.app);
  const sent = await c.send('/api/auth/email-otp/send-verification-otp', { method: 'POST', json: { email, type: 'sign-in' } });
  expect(sent.status).toBe(200);
  await new Promise((r) => setTimeout(r, 20)); // письмо отправляется без ожидания
  const otp = lastCode(email);
  expect(otp, 'письмо с 6-значным кодом').toMatch(/^\d{6}$/);
  const res = await c.send('/api/auth/sign-in/email-otp', { method: 'POST', json: { email, otp } });
  expect(res.status).toBe(200);
  return c;
}

describe('ядро: служебное', () => {
  it('/health отвечает, база доступна', async () => {
    const res = await core.app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('без входа /api/me — 401', async () => {
    const res = await client(core.app).send('/api/me');
    expect(res.status).toBe(401);
  });

  it('CORS: свой сайт — можно с cookie, чужой — нет', async () => {
    const pre = (origin: string) =>
      core.app.request('/api/me', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
    const ours = await pre(WEB);
    expect(ours.headers.get('access-control-allow-origin')).toBe(WEB);
    expect(ours.headers.get('access-control-allow-credentials')).toBe('true');
    const evil = await pre('https://evil.example');
    expect(evil.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });
});

describe('вход по коду из письма', () => {
  it('первый вход создаёт аккаунт; /api/me возвращает пользователя', async () => {
    const c = await signIn('student@example.com');
    const me = await c.send('/api/me');
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { email: string; name: string } };
    expect(body.user.email).toBe('student@example.com');
    expect(body.user.name).toBe('');
  });

  it('cookie сессии — httpOnly, с префиксом denvise', async () => {
    const c = client(core.app);
    await c.send('/api/auth/email-otp/send-verification-otp', { method: 'POST', json: { email: 'cookie@example.com', type: 'sign-in' } });
    await new Promise((r) => setTimeout(r, 20));
    const res = await c.send('/api/auth/sign-in/email-otp', { method: 'POST', json: { email: 'cookie@example.com', otp: lastCode('cookie@example.com') } });
    const cookie = res.headers.getSetCookie().find((s) => s.startsWith('denvise.session_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('сессия живёт 90 дней', async () => {
    await signIn('long@example.com');
    const [u] = await core.db.select().from(user).where(eq(user.email, 'long@example.com'));
    const [s] = await core.db.select().from(session).where(eq(session.userId, u!.id));
    const days = (s!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
  });

  it('повторный вход — тот же аккаунт, не новый', async () => {
    await signIn('again@example.com');
    await signIn('again@example.com');
    const rows = await core.db.select().from(user).where(eq(user.email, 'again@example.com'));
    expect(rows).toHaveLength(1);
  });

  it('3 неверных кода — код сгорает, даже верный больше не подходит', async () => {
    const c = client(core.app);
    const email = 'guess@example.com';
    await c.send('/api/auth/email-otp/send-verification-otp', { method: 'POST', json: { email, type: 'sign-in' } });
    await new Promise((r) => setTimeout(r, 20));
    const right = lastCode(email)!;
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) {
      const r = await c.send('/api/auth/sign-in/email-otp', { method: 'POST', json: { email, otp: wrong } });
      expect(r.status).toBeGreaterThanOrEqual(400);
    }
    const r = await c.send('/api/auth/sign-in/email-otp', { method: 'POST', json: { email, otp: right } });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it('действие от имени пользователя с чужого сайта (подделка запроса) отклоняется', async () => {
    const c = await signIn('csrf@example.com');
    const r = await c.send('/api/auth/update-user', {
      method: 'POST',
      json: { name: 'Взломщик' },
      headers: { Origin: 'https://evil.example' },
    });
    expect(r.status).toBe(403);
    const me = (await (await c.send('/api/me')).json()) as { user: { name: string } };
    expect(me.user.name).toBe('');
  });
});

describe('профиль', () => {
  it('имя можно указать и изменить', async () => {
    const c = await signIn('name@example.com');
    const r = await c.send('/api/auth/update-user', { method: 'POST', json: { name: 'Анна' } });
    expect(r.status).toBe(200);
    const me = (await (await c.send('/api/me')).json()) as { user: { name: string } };
    expect(me.user.name).toBe('Анна');
  });

  it('выход: после sign-out /api/me — 401', async () => {
    const c = await signIn('out@example.com');
    expect((await c.send('/api/auth/sign-out', { method: 'POST', json: {} })).status).toBe(200);
    expect((await c.send('/api/me')).status).toBe(401);
  });
});

describe('удаление аккаунта', () => {
  it('без подтверждения из письма аккаунт не удаляется; по ссылке — удаляется со всеми сессиями', async () => {
    const email = 'delete@example.com';
    const c = await signIn(email);
    const req = await c.send('/api/auth/delete-user', { method: 'POST', json: {} });
    expect(req.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));

    // Пока ссылку не открыли — аккаунт на месте
    expect(await core.db.select().from(user).where(eq(user.email, email))).toHaveLength(1);
    expect((await c.send('/api/me')).status).toBe(200);

    const mail = [...sentEmails].reverse().find((m) => m.to === email && /удален/i.test(m.subject));
    expect(mail, 'письмо с подтверждением удаления').toBeDefined();
    const url = new URL(mail!.text.match(/https?:\/\/\S+/)![0]);
    await c.send(url.pathname + url.search);

    expect(await core.db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
    expect((await c.send('/api/me')).status).toBe(401);
  });
});
