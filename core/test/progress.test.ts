import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { progressEvent, user } from '../src/db/schema.js';
import { client, signIn, startTestCore } from './helpers.js';

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore();
});
afterAll(async () => {
  await core?.stop();
});

const today = new Date().toISOString().slice(0, 10);
let seq = 0;
const ev = (over: Record<string, unknown> = {}) => ({
  id: `e${++seq}-${Date.now()}`,
  kind: 'diag',
  itemId: 'case-1',
  xp: 50,
  localDate: today,
  at: Date.now(),
  ...over,
});
const post = (c: Awaited<ReturnType<typeof signIn>>, events: unknown[]) =>
  c.send('/api/progress/events', { method: 'POST', json: { events } });

describe('прогресс', () => {
  it('без входа — 401', async () => {
    const c = client(core.app);
    expect((await c.send('/api/progress')).status).toBe(401);
    expect((await c.send('/api/progress/events', { method: 'POST', json: { events: [ev()] } })).status).toBe(401);
  });

  it('новый пользователь — пустой прогресс', async () => {
    const c = await signIn(core.app, 'p-empty@example.com');
    expect(await (await c.send('/api/progress')).json()).toEqual({
      xp: 0,
      counts: { diag: 0, comm: 0, exam: 0, patient: 0, station: 0 },
      diagDone: [],
      activeDates: [],
    });
  });

  it('задания складываются: опыт, счётчики, решённые кейсы, дни активности', async () => {
    const c = await signIn(core.app, 'p-sum@example.com');
    const res = await post(c, [
      ev({ kind: 'diag', itemId: 'case-2', xp: 60 }),
      ev({ kind: 'diag', itemId: 'case-1', xp: 40 }),
      ev({ kind: 'diag', itemId: 'case-1', xp: 40 }), // повторное прохождение того же кейса
      ev({ kind: 'comm', itemId: 'sc-1', xp: 70 }),
      ev({ kind: 'exam', itemId: 'ex-1', xp: 120 }),
      ev({ kind: 'patient', itemId: 'p1', xp: 40, localDate: '2026-09-30', at: Date.UTC(2026, 8, 30, 12) }),
      ev({ kind: 'station', itemId: 's1', xp: 80 }),
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      xp: 450,
      counts: { diag: 3, comm: 1, exam: 1, patient: 1, station: 1 },
      diagDone: ['case-1', 'case-2'],
      activeDates: [today, '2026-09-30'],
    });
  });

  it('повторная отправка тех же записей (обрыв связи) не задваивает', async () => {
    const c = await signIn(core.app, 'p-dup@example.com');
    const batch = [ev({ xp: 10 }), ev({ xp: 20 })];
    await post(c, batch);
    const again = await (await post(c, batch)).json();
    expect(again.xp).toBe(30);
    expect(again.counts.diag).toBe(2);
  });

  it('у каждого свой прогресс', async () => {
    const a = await signIn(core.app, 'p-a@example.com');
    const b = await signIn(core.app, 'p-b@example.com');
    const shared = ev({ id: 'same-id', xp: 100 });
    await post(a, [shared]);
    await post(b, [shared]); // тот же id у другого пользователя — отдельная запись
    expect((await (await a.send('/api/progress')).json()).xp).toBe(100);
    expect((await (await b.send('/api/progress')).json()).xp).toBe(100);
  });

  it('мусор отклоняется, неправдоподобные даты отбрасываются', async () => {
    const c = await signIn(core.app, 'p-bad@example.com');
    // Непонятные записи отбрасываются по одной, не ломая всю пачку
    const mixed = await post(c, [ev({ kind: 'hack' }), ev({ xp: 100000 }), ev({ xp: 7 })]);
    expect(mixed.status).toBe(200);
    expect((await mixed.json()).xp).toBe(7);
    expect((await post(c, [])).status).toBe(400);
    expect((await post(c, Array.from({ length: 101 }, () => ev()))).status).toBe(400);
    const res = await post(c, [
      ev({ at: Date.now() + 3 * 86400000 }), // из будущего
      ev({ localDate: '2026-01-05' }), // день не совпадает со временем
      ev({ xp: 5 }),
    ]);
    expect(res.status).toBe(200);
    expect((await res.json()).xp).toBe(12);
  });

  it('«Сбросить прогресс» очищает только свой', async () => {
    const a = await signIn(core.app, 'p-reset-a@example.com');
    const b = await signIn(core.app, 'p-reset-b@example.com');
    await post(a, [ev()]);
    await post(b, [ev()]);
    const res = await a.send('/api/progress', { method: 'DELETE' });
    expect((await res.json()).xp).toBe(0);
    expect((await (await b.send('/api/progress')).json()).xp).toBe(50);
  });

  it('удаление аккаунта удаляет и прогресс', async () => {
    const c = await signIn(core.app, 'p-del@example.com');
    await post(c, [ev()]);
    const [u] = await core.db.select().from(user).where(eq(user.email, 'p-del@example.com'));
    await core.db.delete(user).where(eq(user.id, u!.id));
    expect(await core.db.select().from(progressEvent).where(eq(progressEvent.userId, u!.id))).toHaveLength(0);
  });
});
