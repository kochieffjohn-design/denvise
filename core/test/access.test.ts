import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPromo, disablePromo, formatCode, generateCode, grantPro, normalizeCode, revokePro } from '../src/access.js';
import { accessGrant, promoCode, user } from '../src/db/schema.js';
import { client, signIn, startTestCore } from './helpers.js';

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore();
});
afterAll(async () => {
  await core?.stop();
});

const DAY = 24 * 60 * 60 * 1000;
const me = async (c: Awaited<ReturnType<typeof signIn>>) => (await (await c.send('/api/me')).json()).user.access;
const redeem = (c: Awaited<ReturnType<typeof signIn>>, code: string) =>
  c.send('/api/promo/redeem', { method: 'POST', json: { code } });
const userId = async (email: string) => (await core.db.select().from(user).where(eq(user.email, email)))[0]!.id;

describe('коды', () => {
  it('формат: без похожих символов, ввод с любым регистром и дефисами', () => {
    const code = generateCode();
    expect(code).toMatch(/^DENV[2-9A-HJKMNP-Z]{8}$/);
    expect(formatCode('DENV7K2MQ9XA')).toBe('DENV-7K2M-Q9XA');
    expect(normalizeCode(' denv-7k2m q9xa ')).toBe('DENV7K2MQ9XA');
  });
});

describe('доступ и промокоды', () => {
  it('новый пользователь — бесплатный тариф', async () => {
    const c = await signIn(core.app, 'acc-free@example.com');
    expect(await me(c)).toEqual({ plan: 'free', proUntil: null });
  });

  it('промокод даёт Pro на N дней; ввод в любом виде', async () => {
    const code = await createPromo(core.db, { days: 30, maxUses: 5, note: 'тест' });
    const c = await signIn(core.app, 'acc-promo@example.com');
    const res = await redeem(c, formatCode(code).toLowerCase().replace(/-/g, ' '));
    expect(res.status).toBe(200);
    const access = (await res.json()).access;
    expect(access.plan).toBe('pro');
    const left = Date.parse(access.proUntil) - Date.now();
    expect(left).toBeGreaterThan(29.9 * DAY);
    expect(left).toBeLessThan(30.1 * DAY);
    expect(await me(c)).toEqual(access);
  });

  it('второй раз тот же код — нельзя; другой код — продлевает от конца доступа', async () => {
    const a = await createPromo(core.db, { days: 10, maxUses: 5 });
    const b = await createPromo(core.db, { days: 20, maxUses: 5 });
    const c = await signIn(core.app, 'acc-twice@example.com');
    await redeem(c, a);
    const again = await redeem(c, a);
    expect(again.status).toBe(409);
    expect((await again.json()).error).toMatch(/уже активировали/);
    const access = (await (await redeem(c, b)).json()).access;
    const left = Date.parse(access.proUntil) - Date.now();
    expect(left).toBeGreaterThan(29.9 * DAY); // 10 + 20
  });

  it('лимит активаций и срок действия кода', async () => {
    const one = await createPromo(core.db, { days: 7, maxUses: 1 });
    const x = await signIn(core.app, 'acc-lim-x@example.com');
    const y = await signIn(core.app, 'acc-lim-y@example.com');
    expect((await redeem(x, one)).status).toBe(200);
    const over = await redeem(y, one);
    expect(over.status).toBe(410);
    expect((await over.json()).error).toMatch(/максимальное число/);
    const [row] = await core.db.select().from(promoCode).where(eq(promoCode.code, one));
    expect(row!.uses).toBe(1);

    const old = await createPromo(core.db, { days: 7, maxUses: 10, expiresAt: new Date(Date.now() - 1000) });
    const res = await redeem(y, old);
    expect(res.status).toBe(410);
    expect((await res.json()).error).toMatch(/Срок действия/);
  });

  it('неверный код и без входа', async () => {
    const c = await signIn(core.app, 'acc-bad@example.com');
    const res = await redeem(c, 'DENV-AAAA-BBBB');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Такого промокода нет/);
    expect((await client(core.app).send('/api/promo/redeem', { method: 'POST', json: { code: 'X' } })).status).toBe(401);
  });

  it('перебор кодов ограничен: после 10 попыток — 429', async () => {
    const c = await signIn(core.app, 'acc-brute@example.com');
    for (let i = 0; i < 10; i++) await redeem(c, `DENV-AAAA-AAA${i}`);
    expect((await redeem(c, 'DENV-AAAA-AAAZ')).status).toBe(429);
  });

  it('ручная выдача владельцем, истёкший доступ — снова бесплатный, всё в журнале', async () => {
    const c = await signIn(core.app, 'acc-grant@example.com');
    const id = await userId('acc-grant@example.com');
    await grantPro(core.db, id, 3, 'подарок');
    expect((await me(c)).plan).toBe('pro');
    // Истёк: дата в прошлом
    await core.db.execute(sql`update user_access set pro_until = now() - interval '1 day' where user_id = ${id}`);
    expect((await me(c)).plan).toBe('free');
    const log = await core.db.select().from(accessGrant).where(eq(accessGrant.userId, id));
    expect(log.map((g) => [g.source, g.ref, g.days])).toEqual([['admin', 'подарок', 3]]);
  });

  it('забрать Pro: доступ заканчивается сразу, Pro-контент больше не выдаётся, в журнале — revoke', async () => {
    const c = await signIn(core.app, 'acc-revoke@example.com');
    const id = await userId('acc-revoke@example.com');
    await grantPro(core.db, id, 365);
    expect((await me(c)).plan).toBe('pro');
    expect(await revokePro(core.db, id, 'нарушение')).toBe(true);
    expect((await me(c)).plan).toBe('free');
    expect((await c.send('/api/content/pro')).status).toBe(403);
    expect(await revokePro(core.db, id)).toBe(false); // уже нет
    const log = await core.db.select().from(accessGrant).where(eq(accessGrant.userId, id));
    expect(log.map((g) => g.source)).toEqual(['admin', 'revoke']);
  });

  it('отключённый промокод больше не активируется, выданный по нему Pro остаётся', async () => {
    const code = await createPromo(core.db, { days: 30, maxUses: 10 });
    const early = await signIn(core.app, 'acc-dis-a@example.com');
    await redeem(early, code);
    expect(await disablePromo(core.db, formatCode(code))).toBe(true);
    const late = await signIn(core.app, 'acc-dis-b@example.com');
    const res = await redeem(late, code);
    expect(res.status).toBe(410);
    expect((await me(early)).plan).toBe('pro');
    expect(await disablePromo(core.db, 'DENV-NONE-NONE')).toBe(false);
  });
});
