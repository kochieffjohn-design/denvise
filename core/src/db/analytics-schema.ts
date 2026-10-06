import { date, index, jsonb, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Аналитика без сторонних счётчиков: всё в нашей базе в России.

// Откуда пришёл пользователь — первая метка (ref старосты, utm), привязывается при входе
export const acquisition = pgTable('acquisition', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  ref: text('ref'), // код старосты / партнёра
  source: text('source'), // utm_source: reels, vk, telegram…
  medium: text('medium'),
  campaign: text('campaign'),
  landing: text('landing'), // страница первого захода
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }), // первый заход на сайт (до регистрации)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Дни, когда пользователь открывал приложение (по Москве) — для возвратов D1/D7/D30
export const activityDay = pgTable(
  'activity_day',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })]
);

// События воронки. До входа — только anon_id устройства, после — и user_id
export const analyticsEvent = pgTable(
  'analytics_event',
  {
    id: serial('id').primaryKey(),
    anonId: text('anon_id').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    props: jsonb('props'),
    at: timestamp('at', { withTimezone: true }).notNull(),
  },
  (t) => [index('analytics_event_name_at_idx').on(t.name, t.at), index('analytics_event_anon_idx').on(t.anonId)]
);
