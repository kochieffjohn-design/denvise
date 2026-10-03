import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { dailyUsage } from './db/schema.js';

// Дневные лимиты по тарифу. Сброс в полночь по Москве (аудитория — Россия).
export const DAILY_LIMITS = {
  dentai: { free: 3, pro: 100 },
  exam: { free: 1, pro: Infinity },
} as const;
export type LimitKind = keyof typeof DAILY_LIMITS;

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
export const moscowDay = (now = Date.now()) => new Date(now + MSK_OFFSET_MS).toISOString().slice(0, 10);

/** Засчитать одно использование. false — лимит на сегодня исчерпан (ничего не засчитано). */
export async function takeDaily(db: Db, userId: string, kind: LimitKind, limit: number, now = Date.now()): Promise<boolean> {
  if (limit === Infinity) return true;
  const day = moscowDay(now);
  const rows = await db
    .insert(dailyUsage)
    .values({ userId, day, kind, count: 1 })
    .onConflictDoUpdate({
      target: [dailyUsage.userId, dailyUsage.day, dailyUsage.kind],
      set: { count: sql`${dailyUsage.count} + 1` },
      setWhere: sql`${dailyUsage.count} < ${limit}`,
    })
    .returning({ count: dailyUsage.count });
  return rows.length > 0;
}

/** Вернуть использование, если запрос не удался не по вине пользователя (сбой шлюза). */
export async function refundDaily(db: Db, userId: string, kind: LimitKind, now = Date.now()): Promise<void> {
  await db
    .update(dailyUsage)
    .set({ count: sql`greatest(${dailyUsage.count} - 1, 0)` })
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.day, moscowDay(now)), eq(dailyUsage.kind, kind)));
}

export async function usedToday(db: Db, userId: string, kind: LimitKind, now = Date.now()): Promise<number> {
  const [row] = await db
    .select({ count: dailyUsage.count })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.day, moscowDay(now)), eq(dailyUsage.kind, kind)));
  return row?.count ?? 0;
}
