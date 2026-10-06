import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { Db } from './db/index.js';
import { profile } from './db/schema.js';

export const ROLES = ['student', 'graduate', 'resident', 'doctor', 'assistant', 'other'] as const;
// Вуз спрашиваем у тех, кто учится или только что выпустился
const WITH_UNIVERSITY = new Set(['student', 'graduate', 'resident']);

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, ' '))
    .pipe(z.string().max(max));

const Body = z
  .object({
    firstName: text(40).pipe(z.string().min(1, 'Введите имя')),
    lastName: text(60).optional().nullable(),
    role: z.enum(ROLES),
    course: z.number().int().min(1).max(5).optional().nullable(),
    university: text(120).optional().nullable(),
  })
  .refine((p) => p.role !== 'student' || !!p.course, { message: 'Укажите курс', path: ['course'] })
  .refine((p) => !WITH_UNIVERSITY.has(p.role) || !!p.university, { message: 'Укажите вуз', path: ['university'] });

export type Profile = { firstName: string; lastName: string | null; role: (typeof ROLES)[number]; course: number | null; university: string | null };

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!row) return null;
  return { firstName: row.firstName, lastName: row.lastName, role: row.role as Profile['role'], course: row.course, university: row.university };
}

export function registerProfile(app: Hono<any>, db: Db) {
  app.put('/api/profile', async (c) => {
    const s = c.get('session');
    if (!s) return c.json({ error: 'Войдите в аккаунт.' }, 401);
    const parsed = Body.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте поля.' }, 400);
    const p = parsed.data;
    const values = {
      firstName: p.firstName,
      lastName: p.lastName || null,
      role: p.role,
      // Курс и вуз — только там, где они имеют смысл
      course: p.role === 'student' ? (p.course ?? null) : null,
      university: WITH_UNIVERSITY.has(p.role) ? p.university || null : null,
      updatedAt: new Date(),
    };
    await db.insert(profile).values({ userId: s.user.id, ...values }).onConflictDoUpdate({ target: profile.userId, set: values });
    return c.json({ profile: await getProfile(db, s.user.id) });
  });
}
