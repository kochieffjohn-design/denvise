import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Auth } from './auth.js';
import type { Db } from './db/index.js';
import { type Env, webOrigins } from './env.js';
import { AI_LIMIT, forward, type GatewayConfig, UserRateLimiter } from './gateway.js';
import { registerProgress } from './progress.js';
import { getProfile, registerProfile } from './profile.js';
import { recordActivity, registerAnalytics } from './analytics.js';
import { getAccess, registerAccess } from './access.js';
import { FREE_PATIENT_IDS, registerContent } from './content.js';
import { DAILY_LIMITS, refundDaily, takeDaily } from './limits.js';
import { sql } from 'drizzle-orm';

type Session = Awaited<ReturnType<Auth['api']['getSession']>>;
type Vars = { session: Session };

export function createApp({ env, auth, db, gatewayFetch }: { env: Env; auth: Auth; db: Db; gatewayFetch?: typeof fetch }) {
  const app = new Hono<{ Variables: Vars }>();
  const gw: GatewayConfig = { url: env.GATEWAY_URL, key: env.GATEWAY_KEY, fetchImpl: gatewayFetch };
  const aiLimit = new UserRateLimiter(AI_LIMIT.max, AI_LIMIT.windowMs);

  // Сайт и ядро на разных поддоменах — запросы с cookie разрешены только с наших адресов
  app.use(
    '/api/*',
    cors({
      origin: webOrigins(env),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      maxAge: 600,
    })
  );

  // Жив ли сервер и есть ли связь с базой — для мониторинга
  app.get('/health', async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false, error: 'database' }, 503);
    }
  });

  // Вход, выход, сессия, профиль, удаление аккаунта — Better Auth
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  // Сессия для остальных маршрутов API
  app.use('/api/*', async (c, next) => {
    c.set('session', await auth.api.getSession({ headers: c.req.raw.headers }));
    await next();
  });

  // Текущий пользователь — то, что нужно приложению при запуске
  app.get('/api/me', async (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Не выполнен вход' }, 401);
    const { id, email, name, createdAt } = s.user;
    await recordActivity(db, id); // приложение открыли сегодня
    return c.json({ user: { id, email, name, createdAt, access: await getAccess(db, id), profile: await getProfile(db, id) } });
  });

  // ДентИИ и ИИ-Пациент — только после входа, через шлюз (см. gateway.ts)
  const aiGuard = (c: any): { error: Response; userId?: never } | { error?: never; userId: string } => {
    const s = c.get('session');
    if (!s) return { error: c.json({ error: 'Войдите в аккаунт, чтобы пользоваться ИИ.' }, 401) };
    if (!aiLimit.take(s.user.id)) return { error: c.json({ error: 'Слишком много запросов. Подождите несколько минут.' }, 429) };
    return { userId: s.user.id };
  };

  // ДентИИ: вопросов в день — по тарифу. Сбой шлюза вопрос не съедает
  app.post('/api/dentai/ask', async (c) => {
    const g = aiGuard(c);
    if (g.error !== undefined) return g.error;
    const plan = (await getAccess(db, g.userId)).plan;
    if (!(await takeDaily(db, g.userId, 'dentai', DAILY_LIMITS.dentai[plan]))) {
      return c.json(
        {
          error:
            plan === 'pro'
              ? `Сегодня вы задали ${DAILY_LIMITS.dentai.pro} вопросов — это дневной лимит. Завтра он обновится.`
              : `Без Pro — ${DAILY_LIMITS.dentai.free} вопроса ДентИИ в день. Завтра лимит обновится, а с Pro — до ${DAILY_LIMITS.dentai.pro} вопросов в день.`,
          code: 'DAILY_LIMIT',
        },
        429
      );
    }
    const res = await forward(c, gw, '/api/dentai/ask', 'POST');
    if (res.status >= 500) await refundDaily(db, g.userId, 'dentai');
    return res;
  });

  // ИИ-Пациент: без Pro — только бесплатные пациенты
  app.post('/api/patient/chat', async (c) => {
    const g = aiGuard(c);
    if (g.error !== undefined) return g.error;
    const body = await c.req.json().catch(() => null);
    const patientId = typeof body?.patientId === 'string' ? body.patientId : '';
    if (!FREE_PATIENT_IDS.has(patientId) && (await getAccess(db, g.userId)).plan !== 'pro') {
      return c.json({ error: 'Этот пациент доступен в Pro.', code: 'PRO_ONLY' }, 403);
    }
    return forward(c, gw, '/api/patient/chat', 'POST');
  });
  // Полный текст источника, на который сослался ДентИИ
  app.get('/api/dentai/source/:number{[0-9]+}', (c) => {
    if (!c.get('session')) return c.json({ error: 'Войдите в аккаунт.' }, 401);
    return forward(c, gw, `/api/dentai/source/${c.req.param('number')}`, 'GET');
  });

  // Прогресс: пройденные задания, опыт, серия дней
  registerProgress(app, db);

  // Профиль: имя, роль, курс, вуз
  registerProfile(app, db);

  // Аналитика: события воронки, источник прихода
  registerAnalytics(app, db);

  // Доступ к Pro: промокоды
  registerAccess(app, db);

  // Pro-контент и экзамен по лимиту
  registerContent(app, db);

  return app;
}
