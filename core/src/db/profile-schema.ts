import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Кто пользователь: имя, роль, курс, вуз. Нужно для аналитики (кто приходит)
// и будущих рейтингов. Публично ничего не показывается без отдельного согласия.
export const profile = pgTable('profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  role: text('role').notNull(), // student | graduate | resident | doctor | assistant | other
  course: integer('course'), // только у студентов: 1–5
  university: text('university'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
