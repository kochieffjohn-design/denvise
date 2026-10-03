import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureEmail, sendEmail, sentEmails } from '../src/email.js';
import { createMonitor } from '../src/monitor.js';

// Шлюз-заглушка: /health отвечает по флагу, /internal/alert запоминает тревоги
let gatewayUp = true;
let relayed: { text: string; key: string | null }[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  if (url.endsWith('/health')) {
    if (!gatewayUp) throw new TypeError('fetch failed');
    return new Response('{"ok":true}');
  }
  if (url.endsWith('/internal/alert')) {
    if (!gatewayUp) throw new TypeError('fetch failed');
    relayed.push({ text: JSON.parse(String(init?.body)).text, key: new Headers(init?.headers).get('x-gateway-key') });
    return Response.json({ ok: true });
  }
  throw new Error('неожиданный адрес ' + url);
};

let t = 0;
let disk = 0.5;
const make = () =>
  createMonitor({
    gatewayUrl: 'https://gw.test',
    gatewayKey: 'k'.repeat(32),
    alertEmail: 'owner@example.com',
    fetchImpl: fakeFetch,
    diskFreeShare: async () => disk,
    now: () => t,
  });
const ownerMail = () => sentEmails.filter((m) => m.to === 'owner@example.com');

beforeEach(() => {
  configureEmail({ transport: 'console', from: 'Denvise <noreply@denvise.ru>' });
  gatewayUp = true;
  relayed = [];
  sentEmails.length = 0;
  t = 0;
  disk = 0.5;
});
afterEach(() => {
  configureEmail({ transport: 'console', from: 'Denvise <noreply@denvise.ru>' });
});

describe('мониторинг ядра', () => {
  it('всё работает — тишина', async () => {
    const m = make();
    for (let i = 0; i < 5; i++) await m.tick();
    expect(relayed).toHaveLength(0);
    expect(ownerMail()).toHaveLength(0);
  });

  it('шлюз пропал — после 3 проверок письмо владельцу; вернулся — сообщение в Telegram', async () => {
    const m = make();
    gatewayUp = false;
    await m.tick();
    await m.tick();
    expect(ownerMail()).toHaveLength(0); // разовый сбой — не повод
    await m.tick();
    expect(ownerMail()).toHaveLength(1);
    expect(ownerMail()[0]!.text).toMatch(/Шлюз ДентИИ .* недоступен/);
    await m.tick(); // дальше не повторяем
    expect(ownerMail()).toHaveLength(1);

    t += 7 * 60_000;
    gatewayUp = true;
    await m.tick();
    expect(relayed).toHaveLength(1);
    expect(relayed[0]!.text).toMatch(/снова доступен \(не было ~7 мин\)/);
    expect(relayed[0]!.key).toBe('k'.repeat(32));
  });

  it('мало места на диске — одна тревога, снова после освобождения и повторного заполнения', async () => {
    const m = make();
    disk = 0.05;
    await m.tick();
    await m.tick();
    expect(relayed.map((r) => r.text)).toEqual(['🟠 На машине ядра заканчивается место: свободно 5%']);
    disk = 0.3;
    await m.tick();
    t += 31 * 60_000;
    disk = 0.08;
    await m.tick();
    expect(relayed).toHaveLength(2);
  });

  it('письмо с кодом не ушло — тревога в Telegram, повтор не чаще раза в 30 минут', async () => {
    const m = make();
    m.start();
    try {
      configureEmail({ transport: 'postbox', from: 'Denvise <noreply@denvise.ru>' });
      const broken: typeof fetch = async () => new Response('fail', { status: 500 });
      expect(await sendEmail({ to: 'user@example.com', subject: 's', text: 't' }, broken)).toBe(false);
      await sendEmail({ to: 'user2@example.com', subject: 's', text: 't' }, broken);
      await new Promise((r) => setTimeout(r, 10));
      expect(relayed).toHaveLength(1);
      expect(relayed[0]!.text).toMatch(/Не отправляются письма с кодом входа/);
    } finally {
      m.stop();
    }
  });

  it('Telegram (шлюз) недоступен — тревога уходит письмом', async () => {
    const m = make();
    gatewayUp = false;
    await m.alert('проверка');
    expect(ownerMail().map((e) => e.text)).toEqual(['проверка']);
  });
});
