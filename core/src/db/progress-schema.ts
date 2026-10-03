import { date, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Прогресс — журнал пройденного: каждая запись — одно завершённое задание.
// Опыт, счётчики и серия дней считаются из журнала; из него же позже —
// дневные лимиты тарифа и аналитика слабых тем.
export const progressEvent = pgTable(
  'progress_event',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }), // удалили аккаунт — удалился и прогресс
    // id придумывает приложение: запись, отправленная повторно (обрыв связи), не задвоится
    id: text('id').notNull(),
    kind: text('kind').notNull(), // diag | comm | exam | patient
    itemId: text('item_id'), // какой кейс / сценарий / пациент
    xp: integer('xp').notNull(),
    // День по часам пользователя — для серии «дней подряд»
    localDate: date('local_date', { mode: 'string' }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('progress_event_user_date_idx').on(t.userId, t.localDate)]
);
