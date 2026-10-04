import { randomInt } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from './db/index.js';
import { accessGrant, promoCode, userAccess } from './db/schema.js';
import { UserRateLimiter } from './gateway.js';

// Доступ к Pro. Источник правды — user_access.pro_until; каждая выдача
// (промокод, позже оплата, ручная выдача) пишется в журнал access_grant.

export type Access = { plan: 'free' | 'pro'; proUntil: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAccess(db: Db, userId: string, now = new Date()): Promise<Access> {
  const [row] = await db.select({ proUntil: userAccess.proUntil }).from(userAccess).where(eq(userAccess.userId, userId));
  if (!row) return { plan: 'free', proUntil: null };
  return { plan: row.proUntil > now ? 'pro' : 'free', proUntil: row.proUntil.toISOString() };
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Продлить Pro на days дней: от текущего конца доступа, если он ещё не истёк, иначе от сейчас. */
async function extendPro(tx: Tx, userId: string, days: number, source: string, ref: string | null): Promise<Date> {
  const [cur] = await tx.select({ proUntil: userAccess.proUntil }).from(userAccess).where(eq(userAccess.userId, userId)).for('update');
  const now = new Date();
  const from = cur && cur.proUntil > now ? cur.proUntil : now;
  const until = new Date(from.getTime() + days * DAY_MS);
  await tx
    .insert(userAccess)
    .values({ userId, proUntil: until })
    .onConflictDoUpdate({ target: userAccess.userId, set: { proUntil: until, updatedAt: now } });
  await tx.insert(accessGrant).values({ userId, source, ref, days, proUntil: until });
  return until;
}

/** Ручная выдача владельцем (из командной строки, позже — из админки). */
export async function grantPro(db: Db, userId: string, days: number, note: string | null = null): Promise<Date> {
  return db.transaction((tx) => extendPro(tx, userId, days, 'admin', note));
}

/** Забрать Pro: доступ заканчивается сейчас. В журнале — запись revoke. false — Pro и так не было. */
export async function revokePro(db: Db, userId: string, note: string | null = null): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [cur] = await tx.select({ proUntil: userAccess.proUntil }).from(userAccess).where(eq(userAccess.userId, userId)).for('update');
    if (!cur || cur.proUntil <= now) return false;
    await tx.update(userAccess).set({ proUntil: now, updatedAt: now }).where(eq(userAccess.userId, userId));
    await tx.insert(accessGrant).values({ userId, source: 'revoke', ref: note, days: 0, proUntil: now });
    return true;
  });
}

/** Отключить промокод: новых активаций не будет, уже выданный Pro остаётся. */
export async function disablePromo(db: Db, raw: string): Promise<boolean> {
  const rows = await db
    .update(promoCode)
    .set({ expiresAt: new Date() })
    .where(eq(promoCode.code, normalizeCode(raw)))
    .returning({ code: promoCode.code });
  return rows.length > 0;
}

// Без похожих символов (0/O, 1/I/L), чтобы код легко продиктовать и перепечатать
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Код хранится без дефисов и заглавными: «denv-7k2m q9xa» и «DENV7K2MQ9XA» — один и тот же. */
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^0-9A-Z]/g, '');

/** Красивый вид для владельца: DENV-7K2M-Q9XA. */
export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join('-');

export function generateCode(prefix = 'DENV'): string {
  let s = normalizeCode(prefix);
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export async function createPromo(
  db: Db,
  opts: { days: number; maxUses: number; expiresAt?: Date | null; note?: string | null; code?: string }
): Promise<string> {
  const code = normalizeCode(opts.code ?? generateCode());
  await db.insert(promoCode).values({
    code,
    days: opts.days,
    maxUses: opts.maxUses,
    expiresAt: opts.expiresAt ?? null,
    note: opts.note ?? null,
  });
  return code;
}

export async function listPromos(db: Db) {
  return db.select().from(promoCode).orderBy(desc(promoCode.createdAt));
}

export class PromoError extends Error {
  constructor(public status: 404 | 409 | 410, message: string) {
    super(message);
  }
}

export async function redeemPromo(db: Db, userId: string, raw: string): Promise<Access> {
  const code = normalizeCode(raw);
  if (!code) throw new PromoError(404, 'Такого промокода нет. Проверьте буквы и цифры.');
  await db.transaction(async (tx) => {
    const [promo] = await tx.select().from(promoCode).where(eq(promoCode.code, code)).for('update');
    if (!promo) throw new PromoError(404, 'Такого промокода нет. Проверьте буквы и цифры.');
    if (promo.expiresAt && promo.expiresAt <= new Date()) throw new PromoError(410, 'Срок действия промокода истёк.');
    const [already] = await tx
      .select({ id: accessGrant.id })
      .from(accessGrant)
      .where(sql`${accessGrant.userId} = ${userId} and ${accessGrant.source} = 'promo' and ${accessGrant.ref} = ${code}`);
    if (already) throw new PromoError(409, 'Вы уже активировали этот промокод.');
    if (promo.uses >= promo.maxUses) throw new PromoError(410, 'Этот промокод уже использовали максимальное число раз.');
    await tx.update(promoCode).set({ uses: sql`${promoCode.uses} + 1` }).where(eq(promoCode.code, code));
    await extendPro(tx, userId, promo.days, 'promo', code);
  });
  return getAccess(db, userId);
}

const RedeemBody = z.object({ code: z.string().min(1).max(64) });

export function registerAccess(app: Hono<any>, db: Db) {
  // Перебор кодов: 10 попыток за 10 минут на пользователя
  const attempts = new UserRateLimiter(10, 10 * 60_000);

  app.post('/api/promo/redeem', async (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Войдите в аккаунт, чтобы активировать промокод.' }, 401);
    if (!attempts.take(s.user.id)) return c.json({ error: 'Слишком много попыток. Подождите 10 минут.' }, 429);
    const parsed = RedeemBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Введите промокод.' }, 400);
    try {
      return c.json({ access: await redeemPromo(db, s.user.id, parsed.data.code) });
    } catch (e) {
      if (e instanceof PromoError) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });
}
