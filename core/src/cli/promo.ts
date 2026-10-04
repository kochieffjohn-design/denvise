// Промокоды и ручная выдача Pro — для владельца, из командной строки на машине ядра:
//   deploy/promo.sh prod create --days 90 --uses 10 --note "друзья"
//   deploy/promo.sh prod create --days 30 --uses 1 --expires 2026-12-31 --code DENVFRIEND
//   deploy/promo.sh prod list
//   deploy/promo.sh prod grant --email someone@example.com --days 30 --note "подарок"
//   deploy/promo.sh prod revoke --email someone@example.com --note "причина"   — забрать Pro сейчас
//   deploy/promo.sh prod disable --code DENV-XXXX-XXXX                       — отключить промокод
process.env.TZ = 'UTC';

import { eq } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { createPromo, disablePromo, formatCode, grantPro, listPromos, revokePro } from '../access.js';
import { createDb } from '../db/index.js';
import { user } from '../db/schema.js';

const [command, ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    days: { type: 'string' },
    uses: { type: 'string' },
    expires: { type: 'string' },
    note: { type: 'string' },
    code: { type: 'string' },
    email: { type: 'string' },
  },
});

const int = (v: string | undefined, name: string, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`--${name}: целое число от 1 до ${max}`);
  return n;
};
const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('нет DATABASE_URL');
const { db, pool } = createDb(url);

try {
  if (command === 'create') {
    const days = int(values.days, 'days', 3660);
    const maxUses = int(values.uses ?? '1', 'uses', 100000);
    const expiresAt = values.expires ? new Date(values.expires + 'T23:59:59Z') : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error('--expires: дата ГГГГ-ММ-ДД');
    const code = await createPromo(db, { days, maxUses, expiresAt, note: values.note ?? null, code: values.code });
    console.log(`Промокод: ${formatCode(code)}`);
    console.log(`Pro на ${days} дн., активаций: ${maxUses}, активировать до: ${date(expiresAt)}${values.note ? `, для: ${values.note}` : ''}`);
  } else if (command === 'list') {
    for (const p of await listPromos(db)) {
      console.log(`${formatCode(p.code)}  ${p.days} дн.  использован ${p.uses}/${p.maxUses}  до ${date(p.expiresAt)}  ${p.note ?? ''}`);
    }
  } else if (command === 'grant') {
    const email = values.email?.trim().toLowerCase();
    if (!email) throw new Error('--email обязателен');
    const days = int(values.days, 'days', 3660);
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!u) throw new Error(`Аккаунта ${email} нет — человек должен сначала войти в приложение`);
    const until = await grantPro(db, u.id, days, values.note ?? null);
    console.log(`Pro выдан ${email} до ${date(until)}`);
  } else if (command === 'revoke') {
    const email = values.email?.trim().toLowerCase();
    if (!email) throw new Error('--email обязателен');
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!u) throw new Error(`Аккаунта ${email} нет`);
    console.log((await revokePro(db, u.id, values.note ?? null)) ? `Pro у ${email} отключён` : `У ${email} и так нет Pro`);
  } else if (command === 'disable') {
    if (!values.code) throw new Error('--code обязателен');
    console.log((await disablePromo(db, values.code)) ? `Промокод ${formatCode(values.code.toUpperCase().replace(/[^0-9A-Z]/g, ''))} отключён` : 'Такого промокода нет');
  } else {
    console.log('Команды: create --days N [--uses N] [--expires ГГГГ-ММ-ДД] [--note текст] [--code КОД] | list | grant --email адрес --days N | revoke --email адрес | disable --code КОД');
    process.exitCode = 1;
  }
} catch (e) {
  console.error('Ошибка:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
