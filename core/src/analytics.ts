import type { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from './db/index.js';
import { acquisition, activityDay, analyticsEvent } from './db/schema.js';
import { UserRateLimiter } from './gateway.js';
import { moscowDay } from './limits.js';

// Приём событий воронки и источника прихода. Только наши события из списка —
// случайный мусор в базу не попадает.
export const EVENT_NAMES = [
  'app_open', // запуск приложения (props.standalone — установлено на экран)
  'onboarding_done',
  'code_requested',
  'signed_in',
  'profile_saved',
  'task_done', // завершено задание (props.kind)
  'pro_lock_tap', // нажал на карточку с замком (props.section)
  'promo_redeemed',
  'limit_hit', // упёрся в дневной лимит (props.kind: dentai | exam)
] as const;

const id = z.string().regex(/^[\w-]{8,64}$/);
const short = z.string().trim().max(100).nullish();
const Body = z.object({
  anonId: id,
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        props: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean(), z.null()])).nullish(),
        at: z.number().int(),
      })
    )
    .max(50),
  // Откуда пришёл: сохраняется один раз, при первой отправке после входа
  acquisition: z
    .object({ ref: short, source: short, medium: short, campaign: short, landing: z.string().max(300).nullish(), firstSeenAt: z.number().int().nullish() })
    .nullish(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Пользователь открыл приложение сегодня — для возвратов D1/D7/D30. */
export async function recordActivity(db: Db, userId: string, now = Date.now()) {
  await db.insert(activityDay).values({ userId, day: moscowDay(now) }).onConflictDoNothing();
}

export function registerAnalytics(app: Hono<any>, db: Db) {
  // Защита от засорения: 300 событий за 10 минут на устройство
  const limiter = new UserRateLimiter(300, 10 * 60_000);

  app.post('/api/events', async (c) => {
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Неверные события.' }, 400);
    const { anonId, events, acquisition: acq } = parsed.data;
    const userId: string | null = c.get('session')?.user.id ?? null;
    const now = Date.now();

    const rows = events
      .filter((e) => e.at <= now + DAY_MS && e.at > now - 30 * DAY_MS && limiter.take(anonId))
      .map((e) => ({ anonId, userId, name: e.name, props: e.props ?? null, at: new Date(e.at) }));
    if (rows.length) await db.insert(analyticsEvent).values(rows);

    if (userId && acq && (acq.ref || acq.source || acq.landing)) {
      await db
        .insert(acquisition)
        .values({
          userId,
          ref: acq.ref || null,
          source: acq.source || null,
          medium: acq.medium || null,
          campaign: acq.campaign || null,
          landing: acq.landing || null,
          firstSeenAt: acq.firstSeenAt && acq.firstSeenAt < now + DAY_MS ? new Date(acq.firstSeenAt) : null,
        })
        .onConflictDoNothing(); // первая метка остаётся навсегда
    }
    return c.json({ ok: true, saved: rows.length });
  });
}
