import { and, desc, eq, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from './db/index.js';
import { progressEvent } from './db/schema.js';

// Прогресс пользователя: приложение присылает завершённые задания (в том числе
// накопленные без сети), ядро возвращает итог — его приложение и показывает.

const KINDS = ['diag', 'comm', 'exam', 'patient', 'station'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
// Дней активности в ответе: серии длиннее года пока не бывает
const ACTIVE_DATES_LIMIT = 400;

const Event = z.object({
  id: z.string().regex(/^[\w-]{1,64}$/),
  kind: z.enum(KINDS),
  itemId: z.string().max(64).nullish(),
  // Больше любой награды в приложении — защита от мусора, а не от хитрости
  xp: z.number().int().min(0).max(500),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  at: z.number().int(),
});
// Записи разбираем по одной: непонятная (например, новый вид задания из более
// свежей версии приложения) отбрасывается, остальные сохраняются — иначе
// очередь на устройстве застряла бы навсегда
const Body = z.object({ events: z.array(z.unknown()).min(1).max(100) });

export type ProgressSummary = {
  xp: number;
  counts: Record<(typeof KINDS)[number], number>;
  diagDone: string[];
  /** Дни с активностью по часам пользователя, от свежих к старым. */
  activeDates: string[];
};

/** Дата события правдоподобна: не из будущего и совпадает с днём по часам пользователя (±14 ч пояса). */
function plausible(e: z.infer<typeof Event>, now: number): boolean {
  if (e.at > now + DAY_MS || e.at < Date.UTC(2026, 0, 1)) return false;
  const local = Date.parse(e.localDate + 'T00:00:00Z');
  return Number.isFinite(local) && Math.abs(local + DAY_MS / 2 - e.at) <= DAY_MS;
}

export async function progressSummary(db: Db, userId: string): Promise<ProgressSummary> {
  const mine = eq(progressEvent.userId, userId);
  const [byKind, diag, dates] = await Promise.all([
    db
      .select({ kind: progressEvent.kind, n: sql<number>`count(*)::int`, xp: sql<number>`coalesce(sum(${progressEvent.xp}), 0)::int` })
      .from(progressEvent)
      .where(mine)
      .groupBy(progressEvent.kind),
    db
      .selectDistinct({ itemId: progressEvent.itemId })
      .from(progressEvent)
      .where(and(mine, eq(progressEvent.kind, 'diag'), sql`${progressEvent.itemId} is not null`)),
    db
      .selectDistinct({ d: progressEvent.localDate })
      .from(progressEvent)
      .where(mine)
      .orderBy(desc(progressEvent.localDate))
      .limit(ACTIVE_DATES_LIMIT),
  ]);

  const counts = { diag: 0, comm: 0, exam: 0, patient: 0, station: 0 };
  let xp = 0;
  for (const r of byKind) {
    if (r.kind in counts) counts[r.kind as keyof typeof counts] = r.n;
    xp += r.xp;
  }
  return { xp, counts, diagDone: diag.map((r) => r.itemId!).sort(), activeDates: dates.map((r) => r.d) };
}

export function registerProgress(app: Hono<any>, db: Db) {
  const userId = (c: any): string | null => c.get('session')?.user.id ?? null;
  const unauthorized = { error: 'Войдите в аккаунт, чтобы сохранять прогресс.' };

  app.get('/api/progress', async (c) => {
    const id = userId(c);
    if (!id) return c.json(unauthorized, 401);
    return c.json(await progressSummary(db, id));
  });

  app.post('/api/progress/events', async (c) => {
    const id = userId(c);
    if (!id) return c.json(unauthorized, 401);
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Неверные данные прогресса.' }, 400);

    // Неправдоподобные записи отбрасываем молча: приложение не должно
    // застревать, повторяя их отправку
    const now = Date.now();
    const rows = parsed.data.events
      .map((e) => Event.safeParse(e))
      .flatMap((r) => (r.success ? [r.data] : []))
      .filter((e) => plausible(e, now))
      .map((e) => ({ userId: id, id: e.id, kind: e.kind, itemId: e.itemId ?? null, xp: e.xp, localDate: e.localDate, occurredAt: new Date(e.at) }));
    // Повторно присланная запись (тот же id) игнорируется
    if (rows.length) await db.insert(progressEvent).values(rows).onConflictDoNothing();
    return c.json(await progressSummary(db, id));
  });

  // «Сбросить прогресс» в профиле
  app.delete('/api/progress', async (c) => {
    const id = userId(c);
    if (!id) return c.json(unauthorized, 401);
    await db.delete(progressEvent).where(eq(progressEvent.userId, id));
    return c.json(await progressSummary(db, id));
  });
}
