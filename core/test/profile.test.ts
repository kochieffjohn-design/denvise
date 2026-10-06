import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, signIn, startTestCore } from './helpers.js';

let core: Awaited<ReturnType<typeof startTestCore>>;
beforeAll(async () => {
  core = await startTestCore();
});
afterAll(async () => {
  await core?.stop();
});

type C = Awaited<ReturnType<typeof signIn>>;
const save = (c: C, body: unknown) => c.send('/api/profile', { method: 'PUT', json: body });
const me = async (c: C) => (await (await c.send('/api/me')).json()).user.profile;

describe('профиль', () => {
  it('новый пользователь — профиля нет', async () => {
    const c = await signIn(core.app, 'prof-new@example.com');
    expect(await me(c)).toBeNull();
  });

  it('студент: имя, курс, вуз сохраняются; лишние пробелы убираются', async () => {
    const c = await signIn(core.app, 'prof-st@example.com');
    const res = await save(c, { firstName: '  Иван ', lastName: 'Петров', role: 'student', course: 5, university: ' МГМСУ   им. Евдокимова ' });
    expect(res.status).toBe(200);
    const p = { firstName: 'Иван', lastName: 'Петров', role: 'student', course: 5, university: 'МГМСУ им. Евдокимова' };
    expect((await res.json()).profile).toEqual(p);
    expect(await me(c)).toEqual(p);
  });

  it('врачу курс и вуз не нужны и не сохраняются', async () => {
    const c = await signIn(core.app, 'prof-doc@example.com');
    const res = await save(c, { firstName: 'Анна', role: 'doctor', course: 3, university: 'что-то' });
    expect((await res.json()).profile).toEqual({ firstName: 'Анна', lastName: null, role: 'doctor', course: null, university: null });
  });

  it('проверки: имя, курс у студента, вуз у студента/выпускника/ординатора', async () => {
    const c = await signIn(core.app, 'prof-bad@example.com');
    const err = async (body: unknown) => {
      const r = await save(c, body);
      expect(r.status).toBe(400);
      return (await r.json()).error;
    };
    expect(await err({ firstName: '  ', role: 'doctor' })).toMatch(/имя/);
    expect(await err({ firstName: 'Иван', role: 'student', university: 'РНИМУ' })).toMatch(/курс/);
    expect(await err({ firstName: 'Иван', role: 'graduate' })).toMatch(/вуз/);
    expect(await err({ firstName: 'Иван', role: 'hacker' })).toBeTruthy();
    expect(await err({ firstName: 'Иван', role: 'student', course: 9, university: 'X' })).toBeTruthy();
  });

  it('CORS: сайт может сохранять профиль методом PUT', async () => {
    const res = await core.app.request('/api/profile', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'PUT' } });
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
  });

  it('можно изменить; без входа — 401', async () => {
    const c = await signIn(core.app, 'prof-edit@example.com');
    await save(c, { firstName: 'Олег', role: 'student', course: 4, university: 'КГМУ' });
    await save(c, { firstName: 'Олег', role: 'graduate', university: 'КГМУ' });
    expect((await me(c)).role).toBe('graduate');
    expect((await me(c)).course).toBeNull();
    expect((await client(core.app).send('/api/profile', { method: 'PUT', json: { firstName: 'X', role: 'other' } })).status).toBe(401);
  });
});
