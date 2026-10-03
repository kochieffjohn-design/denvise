import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sentEmails } from '../src/email.js';
import { AI_LIMIT, UserRateLimiter } from '../src/gateway.js';
import { client, startTestCore, WEB } from './helpers.js';

// Шлюз-заглушка: запоминает, что ему прислали, и отвечает заданным образом
type Call = { url: string; method: string; headers: Headers; body: string | null };
let calls: Call[] = [];
let reply: () => Promise<Response> = async () => Response.json({ answer: 'Ответ', sources: [] });
const fakeGateway: typeof fetch = async (input, init) => {
  calls.push({ url: String(input), method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: (init?.body as string) ?? null });
  return reply();
};

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore({ gatewayFetch: fakeGateway });
});
afterAll(async () => {
  await core?.stop();
});
beforeEach(() => {
  calls = [];
  reply = async () => Response.json({ answer: 'Ответ', sources: [] });
});

async function signIn(email: string) {
  const c = client(core.app);
  await c.send('/api/auth/email-otp/send-verification-otp', { method: 'POST', json: { email, type: 'sign-in' } });
  await new Promise((r) => setTimeout(r, 20));
  const otp = [...sentEmails].reverse().find((m) => m.to === email)?.text.match(/\b(\d{6})\b/)?.[1];
  const res = await c.send('/api/auth/sign-in/email-otp', { method: 'POST', json: { email, otp } });
  expect(res.status).toBe(200);
  return c;
}

const ask = { messages: [{ role: 'user', content: 'Доза артикаина детям?' }] };

describe('ДентИИ и ИИ-Пациент через ядро', () => {
  it('без входа — 401, шлюз не вызывается', async () => {
    const res = await client(core.app).send('/api/dentai/ask', { method: 'POST', json: ask });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/Войдите/);
    expect(calls).toHaveLength(0);
  });

  it('после входа: запрос уходит в шлюз с ключом и без данных пользователя', async () => {
    const c = await signIn('gw1@example.com');
    const res = await c.send('/api/dentai/ask', { method: 'POST', json: ask });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: 'Ответ', sources: [] });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe('https://gateway.test/api/dentai/ask');
    expect(call.method).toBe('POST');
    expect(call.headers.get('x-gateway-key')).toBe('test-gateway-key-test-gateway-key-00');
    expect(JSON.parse(call.body!)).toEqual(ask);
    // Ни cookie, ни IP, ни почты — шлюзу это знать незачем
    expect(call.headers.get('cookie')).toBeNull();
    expect(call.headers.get('x-forwarded-for')).toBeNull();
    expect(call.body).not.toContain('gw1@example.com');
  });

  it('ответ виден сайту: CORS с cookie для своего адреса', async () => {
    const c = await signIn('gw-cors@example.com');
    const res = await c.send('/api/patient/chat', { method: 'POST', json: { patientId: 'p1', ...ask } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(WEB);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(calls[0]!.url).toBe('https://gateway.test/api/patient/chat');
  });

  it('ошибки шлюза передаются как есть (тексты уже на русском)', async () => {
    const c = await signIn('gw2@example.com');
    reply = async () => Response.json({ error: 'Слишком длинная история диалога' }, { status: 400 });
    const res = await c.send('/api/dentai/ask', { method: 'POST', json: ask });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Слишком длинная история диалога');
  });

  it('шлюз недоступен — 502 с понятным текстом', async () => {
    const c = await signIn('gw3@example.com');
    reply = async () => {
      throw new TypeError('fetch failed');
    };
    const res = await c.send('/api/dentai/ask', { method: 'POST', json: ask });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Не удалось связаться с ИИ/);
  });

  it('источник ДентИИ — только после входа, номер — только цифры', async () => {
    expect((await client(core.app).send('/api/dentai/source/3')).status).toBe(401);
    const c = await signIn('gw4@example.com');
    reply = async () => Response.json({ number: 3, title: 'Протокол', text: '…' });
    const res = await c.send('/api/dentai/source/3');
    expect(res.status).toBe(200);
    expect(calls.at(-1)!.url).toBe('https://gateway.test/api/dentai/source/3');
    expect(calls.at(-1)!.method).toBe('GET');
    expect((await c.send('/api/dentai/source/..%2Fhealth')).status).toBe(404);
  });

  it(`лимит на пользователя: ${AI_LIMIT.max} запросов, дальше 429; у другого — свой счёт`, async () => {
    const a = await signIn('gw-limit-a@example.com');
    for (let i = 0; i < AI_LIMIT.max; i++) {
      expect((await a.send('/api/dentai/ask', { method: 'POST', json: ask })).status).toBe(200);
    }
    const over = await a.send('/api/patient/chat', { method: 'POST', json: ask });
    expect(over.status).toBe(429);
    expect((await over.json()).error).toMatch(/Слишком много запросов/);

    const b = await signIn('gw-limit-b@example.com');
    expect((await b.send('/api/dentai/ask', { method: 'POST', json: ask })).status).toBe(200);
  });
});

describe('UserRateLimiter', () => {
  it('окно сдвигается: старые запросы перестают считаться', () => {
    let t = 0;
    const l = new UserRateLimiter(2, 1000, () => t);
    expect(l.take('u')).toBe(true);
    expect(l.take('u')).toBe(true);
    expect(l.take('u')).toBe(false);
    t = 1001;
    expect(l.take('u')).toBe(true);
  });
});
