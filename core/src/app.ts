import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Auth } from './auth.js';
import type { Db } from './db/index.js';
import { type Env, webOrigins } from './env.js';
import { sql } from 'drizzle-orm';

type Session = Awaited<ReturnType<Auth['api']['getSession']>>;
type Vars = { session: Session };

export function createApp({ env, auth, db }: { env: Env; auth: Auth; db: Db }) {
  const app = new Hono<{ Variables: Vars }>();

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
  app.get('/api/me', (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Не выполнен вход' }, 401);
    const { id, email, name, createdAt } = s.user;
    return c.json({ user: { id, email, name, createdAt } });
  });

  return app;
}
