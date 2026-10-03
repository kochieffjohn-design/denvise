import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Сколько раз за день пользователь воспользовался ограниченной функцией
// (вопросы ДентИИ, экзамены). День — по Москве.
export const dailyUsage = pgTable(
  'daily_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    kind: text('kind').notNull(), // dentai | exam
    count: integer('count').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.kind] })]
);
