// Сводка аналитики для владельца: deploy/stats.sh prod [дней=30]
process.env.TZ = 'UTC';

import { sql } from 'drizzle-orm';
import { createDb } from '../db/index.js';

const days = Number(process.argv[2] || 30);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('нет DATABASE_URL');
const { db, pool } = createDb(url);

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const ROLE: Record<string, string> = { student: 'студент', graduate: 'выпускник', resident: 'ординатор', doctor: 'врач', assistant: 'ассистент', other: 'другое' };
const pct = (a: number, b: number) => (b ? `${Math.round((a * 100) / b)}%` : '—');
const MSK = sql`interval '3 hours'`;
const since = sql`now() - make_interval(days => ${days})`;

try {
  console.log(`\n=== Denvise: последние ${days} дн. (день — по Москве) ===\n`);

  const [u] = await rows<{ total: number; fresh: number; pro: number }>(sql`
    select (select count(*)::int from "user") total,
           (select count(*)::int from "user" where created_at > ${since}) fresh,
           (select count(*)::int from user_access where pro_until > now()) pro`);
  console.log(`Пользователей всего: ${u!.total}, новых за период: ${u!.fresh}, с Pro сейчас: ${u!.pro}`);

  console.log('\n— Кто пришёл (новые за период) —');
  for (const r of await rows<{ who: string; n: number }>(sql`
      select coalesce(p.role || coalesce(' ' || p.course || ' курс', ''), 'профиль не заполнен') who, count(*)::int n
      from "user" u left join profile p on p.user_id = u.id
      where u.created_at > ${since} group by 1 order by 2 desc`))
    console.log(`  ${r.who.replace(/^[a-z]+/, (k) => ROLE[k] ?? k)}: ${r.n}`);

  console.log('\n— Вузы (топ-10, новые за период) —');
  for (const r of await rows<{ university: string; n: number }>(sql`
      select p.university, count(*)::int n from profile p join "user" u on u.id = p.user_id
      where p.university is not null and u.created_at > ${since} group by 1 order by 2 desc limit 10`))
    console.log(`  ${r.university}: ${r.n}`);

  console.log('\n— Откуда пришли (новые за период) —');
  for (const r of await rows<{ src: string; n: number; active: number }>(sql`
      select coalesce('ref ' || a.ref, a.source, 'без метки') src, count(*)::int n,
             count(*) filter (where exists (select 1 from progress_event e where e.user_id = u.id))::int active
      from "user" u left join acquisition a on a.user_id = u.id
      where u.created_at > ${since} group by 1 order by 2 desc`))
    console.log(`  ${r.src}: ${r.n} (прошли хотя бы одно задание: ${r.active})`);

  console.log('\n— Воронка (уникальные устройства за период) —');
  const steps: [string, string][] = [
    ['app_open', 'открыли приложение'],
    ['onboarding_done', 'прошли онбординг'],
    ['code_requested', 'запросили код'],
    ['signed_in', 'вошли'],
    ['profile_saved', 'заполнили профиль'],
    ['task_done', 'прошли задание'],
  ];
  let first = 0;
  for (const [name, label] of steps) {
    const [r] = await rows<{ n: number }>(sql`
      select count(distinct anon_id)::int n from analytics_event where name = ${name} and at > ${since}`);
    if (!first) first = r!.n;
    console.log(`  ${label}: ${r!.n} (${pct(r!.n, first)})`);
  }

  // Активация: задание в день регистрации
  const [act] = await rows<{ signups: number; activated: number }>(sql`
    select count(*)::int signups,
           count(*) filter (where exists (
             select 1 from progress_event e where e.user_id = u.id
             and (e.occurred_at + ${MSK})::date = (u.created_at + ${MSK})::date))::int activated
    from "user" u where u.created_at > ${since}`);
  console.log(`\nАктивация (задание в день регистрации): ${act!.activated} из ${act!.signups} — ${pct(act!.activated, act!.signups)}`);

  // Возвраты: только для тех, у кого прошло достаточно дней
  console.log('\n— Возвраты —');
  for (const [n, label] of [
    [1, 'D1 — вернулись на следующий день'],
    [7, 'D7 — заходили на 7–13-й день'],
    [30, 'D30 — заходили на 30–59-й день'],
  ] as const) {
    const [r] = await rows<{ cohort: number; back: number }>(sql`
      select count(*)::int cohort,
             count(*) filter (where exists (
               select 1 from activity_day d where d.user_id = u.id
               and d.day between (u.created_at + ${MSK})::date + ${n}::int
                             and (u.created_at + ${MSK})::date + ${n === 1 ? 1 : n * 2 - 1}::int))::int back
      from "user" u
      where u.created_at > ${since}
        and (u.created_at + ${MSK})::date + ${n === 1 ? 1 : n * 2 - 1}::int < (now() + ${MSK})::date`);
    console.log(`  ${label}: ${r!.cohort ? `${r!.back} из ${r!.cohort} — ${pct(r!.back, r!.cohort)}` : 'ещё рано считать'}`);
  }

  console.log('\n— Сигналы интереса к Pro (уникальные пользователи за период) —');
  for (const [name, label] of [
    ['pro_lock_tap', 'нажимали на замок'],
    ['limit_hit', 'упирались в дневной лимит'],
    ['promo_redeemed', 'активировали промокод'],
  ] as const) {
    const [r] = await rows<{ n: number }>(sql`
      select count(distinct coalesce(user_id, anon_id))::int n from analytics_event where name = ${name} and at > ${since}`);
    console.log(`  ${label}: ${r!.n}`);
  }
  console.log('');
} finally {
  await pool.end();
}
