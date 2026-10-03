import { sql } from 'drizzle-orm';
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

// Доступ к Pro: до какого момента он есть у пользователя
export const userAccess = pgTable('user_access', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  proUntil: timestamptz('pro_until').notNull(),
  updatedAt: timestamptz('updated_at').defaultNow().notNull(),
});

// Журнал выдач доступа: промокод, оплата (позже), ручная выдача владельцем
export const accessGrant = pgTable(
  'access_grant',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // promo | admin | payment
    ref: text('ref'), // код промокода, номер платежа…
    days: integer('days').notNull(),
    proUntil: timestamptz('pro_until').notNull(), // до какого момента стал доступ после выдачи
    createdAt: timestamptz('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('access_grant_user_idx').on(t.userId),
    // Один промокод — один раз на пользователя
    uniqueIndex('access_grant_promo_once').on(t.userId, t.ref).where(sql`${t.source} = 'promo'`),
  ]
);

export const promoCode = pgTable('promo_code', {
  code: text('code').primaryKey(), // хранится без дефисов, заглавными
  days: integer('days').notNull(),
  maxUses: integer('max_uses').notNull(),
  uses: integer('uses').default(0).notNull(),
  expiresAt: timestamptz('expires_at'), // до какого момента код можно активировать
  note: text('note'), // для кого (видно только владельцу)
  createdAt: timestamptz('created_at').defaultNow().notNull(),
});

function timestamptz(name: string) {
  return timestamp(name, { withTimezone: true });
}
