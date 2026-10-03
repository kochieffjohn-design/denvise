import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Hono } from 'hono';
import { getAccess } from './access.js';
import type { Db } from './db/index.js';
import { DAILY_LIMITS, takeDaily, usedToday } from './limits.js';

// Pro-контент: кейсы, которых нет в приложении. Выдаётся только с Pro;
// приложение сохраняет его на устройстве и обновляет, когда меняется версия.
// Бесплатный контент лежит в самом приложении (data/).

const PRO_FILE = new URL('../content/pro.json', import.meta.url);

export function loadProContent() {
  const raw = readFileSync(PRO_FILE, 'utf8');
  return { body: raw, version: createHash('sha256').update(raw).digest('hex').slice(0, 16) };
}

/** ИИ-Пациенты без Pro. Тот же список — в приложении (data/proCatalog.ts). */
export const FREE_PATIENT_IDS = new Set(['anx', 'rat']);

export function registerContent(app: Hono<any>, db: Db) {
  const pro = loadProContent();
  const etag = `"${pro.version}"`;

  app.get('/api/content/pro', async (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Войдите в аккаунт.' }, 401);
    if ((await getAccess(db, s.user.id)).plan !== 'pro') return c.json({ error: 'Доступно в Pro.' }, 403);
    const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' };
    if (c.req.header('if-none-match') === etag) return c.body(null, 304, headers);
    return c.body(pro.body, 200, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  });

  // Экзамен: без Pro — один в день. Приложение спрашивает перед началом
  app.post('/api/exam/start', async (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Войдите в аккаунт.' }, 401);
    const plan = (await getAccess(db, s.user.id)).plan;
    const limit = DAILY_LIMITS.exam[plan];
    if (!(await takeDaily(db, s.user.id, 'exam', limit))) {
      return c.json({ error: 'Без Pro — один экзамен в день. Следующий будет доступен завтра, а с Pro — без ограничений.', code: 'DAILY_LIMIT' }, 429);
    }
    return c.json({ ok: true, left: limit === Infinity ? null : limit - (await usedToday(db, s.user.id, 'exam')) });
  });
}
