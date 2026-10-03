import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Auth } from './auth.js';
import type { Db } from './db/index.js';
import { type Env, webOrigins } from './env.js';
import { AI_LIMIT, forward, type GatewayConfig, UserRateLimiter } from './gateway.js';
import { registerProgress } from './progress.js';
import { getAccess, registerAccess } from './access.js';
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
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
    return c.json({ user: { id, email, name, createdAt, access: await getAccess(db, id) } });
  });

  // ДентИИ и ИИ-Пациент — только после входа, через шлюз (см. gateway.ts)
  for (const path of ['/api/dentai/ask', '/api/patient/chat']) {
    app.post(path, (c) => {
      const s = c.get('session');
      if (!s) return c.json({ error: 'Войдите в аккаунт, чтобы пользоваться ИИ.' }, 401);
      if (!aiLimit.take(s.user.id)) return c.json({ error: 'Слишком много запросов. Подождите несколько минут.' }, 429);
      return forward(c, gw, path, 'POST');
    });
  }
  // Полный текст источника, на который сослался ДентИИ
  app.get('/api/dentai/source/:number{[0-9]+}', (c) => {
    if (!c.get('session')) return c.json({ error: 'Войдите в аккаунт.' }, 401);
    return forward(c, gw, `/api/dentai/source/${c.req.param('number')}`, 'GET');
  });

  // Прогресс: пройденные задания, опыт, серия дней
  registerProgress(app, db);

  // Доступ к Pro: промокоды
  registerAccess(app, db);

  return app;
}
