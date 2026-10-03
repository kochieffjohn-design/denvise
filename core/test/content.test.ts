import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { grantPro } from '../src/access.js';
import { user } from '../src/db/schema.js';
import { DAILY_LIMITS, moscowDay } from '../src/limits.js';
import { client, signIn, startTestCore } from './helpers.js';

let gatewayStatus = 200;
let gatewayCalls = 0;
const fakeGateway: typeof fetch = async () => {
  gatewayCalls++;
  return Response.json(gatewayStatus === 200 ? { answer: 'ok' } : { error: 'сбой' }, { status: gatewayStatus });
};

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore({ gatewayFetch: fakeGateway });
});
afterAll(async () => {
  await core?.stop();
});
beforeEach(() => {
  gatewayStatus = 200;
  gatewayCalls = 0;
});

type C = Awaited<ReturnType<typeof signIn>>;
const makePro = async (email: string) => {
  const [u] = await core.db.select().from(user).where(eq(user.email, email));
  await grantPro(core.db, u!.id, 30);
};
const ask = (c: C) => c.send('/api/dentai/ask', { method: 'POST', json: { messages: [{ role: 'user', content: 'вопрос' }] } });
const chat = (c: C, patientId: string) =>
  c.send('/api/patient/chat', { method: 'POST', json: { patientId, messages: [{ role: 'user', content: 'Здравствуйте' }] } });

describe('Pro-контент', () => {
  it('без входа — 401, без Pro — 403', async () => {
    expect((await client(core.app).send('/api/content/pro')).status).toBe(401);
    const c = await signIn(core.app, 'cnt-free@example.com');
    const res = await c.send('/api/content/pro');
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/Pro/);
  });

  it('с Pro — весь Pro-контент; та же версия — 304 без тела', async () => {
    const c = await signIn(core.app, 'cnt-pro@example.com');
    await makePro('cnt-pro@example.com');
    const res = await c.send('/api/content/pro');
    expect(res.status).toBe(200);
    const etag = res.headers.get('etag')!;
    expect(etag).toMatch(/^"[0-9a-f]{16}"$/);
    const body = await res.json();
    expect(body.diag.map((d: { id: string }) => d.id)).toEqual(['d6', 'd7', 'd8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14', 'd15', 'd16', 'd17']);
    expect(body.diag.every((d: any) => d.requiredMethods?.length && d.methodResults)).toBe(true);
    expect(body.comm.map((s: { id: string }) => s.id)).toEqual(['c5', 'c6', 'c7', 'c8']);
    expect(body.comm.every((s: any) => s.quiz.length > 0)).toBe(true);
    expect(body.consult.map((s: { id: string }) => s.id)).toEqual(['orthopedics', 'surgery', 'ortho']);
    expect(body.procedures.map((p: { name: string }) => p.name)).toContain('Брекет-система');
    expect(body.procedures.map((p: { name: string }) => p.name)).toContain('Элайнеры');

    const again = await c.send('/api/content/pro', { headers: { 'If-None-Match': etag } });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
  });
});

describe('ИИ-Пациент по тарифу', () => {
  it('без Pro — только Мария Петровна и Наталья', async () => {
    const c = await signIn(core.app, 'pat-free@example.com');
    expect((await chat(c, 'anx')).status).toBe(200);
    expect((await chat(c, 'rat')).status).toBe(200);
    const vip = await chat(c, 'vip');
    expect(vip.status).toBe(403);
    expect((await vip.json()).error).toMatch(/доступен в Pro/);
    expect(gatewayCalls).toBe(2);
  });

  it('с Pro — все', async () => {
    const c = await signIn(core.app, 'pat-pro@example.com');
    await makePro('pat-pro@example.com');
    expect((await chat(c, 'vip')).status).toBe(200);
  });
});

describe('дневные лимиты', () => {
  it(`ДентИИ без Pro: ${DAILY_LIMITS.dentai.free} вопроса в день, дальше понятный отказ`, async () => {
    const c = await signIn(core.app, 'lim-free@example.com');
    for (let i = 0; i < DAILY_LIMITS.dentai.free; i++) expect((await ask(c)).status).toBe(200);
    const over = await ask(c);
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.code).toBe('DAILY_LIMIT');
    expect(body.error).toMatch(/Без Pro — 3 вопроса ДентИИ в день/);
    expect(gatewayCalls).toBe(DAILY_LIMITS.dentai.free);
  });

  it('сбой шлюза вопрос не съедает', async () => {
    const c = await signIn(core.app, 'lim-refund@example.com');
    gatewayStatus = 502;
    for (let i = 0; i < 5; i++) expect((await ask(c)).status).toBe(502);
    gatewayStatus = 200;
    for (let i = 0; i < DAILY_LIMITS.dentai.free; i++) expect((await ask(c)).status).toBe(200);
  });

  it('с Pro лимит ДентИИ выше', async () => {
    const c = await signIn(core.app, 'lim-pro@example.com');
    await makePro('lim-pro@example.com');
    for (let i = 0; i < DAILY_LIMITS.dentai.free + 2; i++) expect((await ask(c)).status).toBe(200);
  });

  it('экзамен без Pro — один в день, с Pro — без ограничений', async () => {
    const free = await signIn(core.app, 'exam-free@example.com');
    const first = await free.send('/api/exam/start', { method: 'POST' });
    expect(first.status).toBe(200);
    expect((await first.json()).left).toBe(0);
    const second = await free.send('/api/exam/start', { method: 'POST' });
    expect(second.status).toBe(429);
    expect((await second.json()).error).toMatch(/один экзамен в день/);

    const pro = await signIn(core.app, 'exam-pro@example.com');
    await makePro('exam-pro@example.com');
    for (let i = 0; i < 3; i++) expect((await pro.send('/api/exam/start', { method: 'POST' })).status).toBe(200);
  });

  it('день считается по Москве', () => {
    expect(moscowDay(Date.UTC(2026, 9, 3, 20, 59))).toBe('2026-10-03'); // 23:59 МСК
    expect(moscowDay(Date.UTC(2026, 9, 3, 21, 0))).toBe('2026-10-04'); // 00:00 МСК
  });
});
