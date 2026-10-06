import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acquisition, activityDay, analyticsEvent, user } from '../src/db/schema.js';
import { moscowDay } from '../src/limits.js';
import { client, signIn, startTestCore } from './helpers.js';

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore();
});
afterAll(async () => {
  await core?.stop();
});

const uid = async (email: string) => (await core.db.select().from(user).where(eq(user.email, email)))[0]!.id;
const send = (c: ReturnType<typeof client>, body: unknown) => c.send('/api/events', { method: 'POST', json: body });

describe('аналитика', () => {
  it('до входа: события принимаются по anon_id, без пользователя', async () => {
    const c = client(core.app);
    const res = await send(c, { anonId: 'anon-before-1', events: [{ name: 'app_open', props: { standalone: false }, at: Date.now() }, { name: 'onboarding_done', at: Date.now() }] });
    expect(res.status).toBe(200);
    const rows = await core.db.select().from(analyticsEvent).where(eq(analyticsEvent.anonId, 'anon-before-1'));
    expect(rows.map((r) => [r.name, r.userId])).toEqual([['app_open', null], ['onboarding_done', null]]);
  });

  it('после входа: события привязаны к пользователю, источник сохраняется один раз', async () => {
    const c = await signIn(core.app, 'an-src@example.com');
    const id = await uid('an-src@example.com');
    const first = Date.now() - 3600_000;
    await send(c, { anonId: 'anon-src-1', events: [{ name: 'signed_in', at: Date.now() }], acquisition: { ref: 'STAROSTA7', source: 'telegram', landing: '/?ref=STAROSTA7', firstSeenAt: first } });
    await send(c, { anonId: 'anon-src-1', events: [], acquisition: { ref: 'OTHER', source: 'vk' } });
    const [a] = await core.db.select().from(acquisition).where(eq(acquisition.userId, id));
    expect([a!.ref, a!.source, a!.landing, a!.firstSeenAt?.getTime()]).toEqual(['STAROSTA7', 'telegram', '/?ref=STAROSTA7', first]);
    const [e] = await core.db.select().from(analyticsEvent).where(eq(analyticsEvent.anonId, 'anon-src-1'));
    expect(e!.userId).toBe(id);
  });

  it('чужие названия событий и мусор — 400', async () => {
    const c = client(core.app);
    expect((await send(c, { anonId: 'anon-bad-1', events: [{ name: 'hack', at: Date.now() }] })).status).toBe(400);
    expect((await send(c, { anonId: 'x', events: [] })).status).toBe(400);
    expect((await send(c, { anonId: 'anon-bad-1', events: Array.from({ length: 51 }, () => ({ name: 'app_open', at: Date.now() })) })).status).toBe(400);
  });

  it('события с неправдоподобным временем отбрасываются', async () => {
    const c = client(core.app);
    const res = await send(c, { anonId: 'anon-time-1', events: [{ name: 'app_open', at: Date.now() + 5 * 86400_000 }, { name: 'app_open', at: Date.now() }] });
    expect((await res.json()).saved).toBe(1);
  });

  it('открытие приложения (/api/me) отмечает день активности, повтор — без дублей', async () => {
    const c = await signIn(core.app, 'an-day@example.com');
    await c.send('/api/me');
    await c.send('/api/me');
    const days = await core.db.select().from(activityDay).where(eq(activityDay.userId, await uid('an-day@example.com')));
    expect(days.map((d) => d.day)).toEqual([moscowDay()]);
  });
});
