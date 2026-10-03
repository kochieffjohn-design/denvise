import { afterEach, describe, expect, it } from 'vitest';
import { configureEmail, resetEmailState, sendEmail } from '../src/email.js';
import { loadEnv } from '../src/env.js';

type Call = { url: string; init?: RequestInit };

/** Подменённая сеть: метаданные машины выдают токен, Postbox принимает письмо. */
function fakeNet(postboxStatus = 200) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('169.254.169.254')) return new Response(JSON.stringify({ access_token: 't-123', expires_in: 3600, token_type: 'Bearer' }));
    if (u.includes('postbox.cloud.yandex.net')) return new Response(postboxStatus === 200 ? '{"MessageId":"m1"}' : '{"message":"nope"}', { status: postboxStatus });
    throw new Error('unexpected ' + u);
  }) as typeof fetch;
  return { calls, impl };
}

afterEach(() => {
  resetEmailState();
  configureEmail({ transport: 'console', from: 'Denvise <noreply@denvise.ru>' });
});

describe('письма через Postbox', () => {
  it('берёт токен у метаданных машины и отправляет письмо в формате Postbox', async () => {
    configureEmail({ transport: 'postbox', from: 'Denvise <noreply@denvise.ru>' });
    const net = fakeNet();
    await sendEmail({ to: 'a@example.com', subject: 'Код входа в Denvise: 123456', text: 'Ваш код: 123456' }, net.impl);

    const meta = net.calls.find((c) => c.url.includes('169.254.169.254'))!;
    expect(new Headers(meta.init?.headers).get('Metadata-Flavor')).toBe('Google');
    const send = net.calls.find((c) => c.url === 'https://postbox.cloud.yandex.net/v2/email/outbound-emails')!;
    expect(new Headers(send.init?.headers).get('X-YaCloud-SubjectToken')).toBe('t-123');
    const body = JSON.parse(String(send.init?.body));
    expect(body.FromEmailAddress).toBe('Denvise <noreply@denvise.ru>');
    expect(body.Destination.ToAddresses).toEqual(['a@example.com']);
    expect(body.Content.Simple.Subject).toEqual({ Data: 'Код входа в Denvise: 123456', Charset: 'UTF-8' });
    expect(body.Content.Simple.Body.Text.Charset).toBe('UTF-8');
  });

  it('токен переиспользуется, пока не истёк', async () => {
    configureEmail({ transport: 'postbox', from: 'x <noreply@denvise.ru>' });
    const net = fakeNet();
    await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }, net.impl);
    await sendEmail({ to: 'b@example.com', subject: 's', text: 't' }, net.impl);
    expect(net.calls.filter((c) => c.url.includes('169.254.169.254'))).toHaveLength(1);
    expect(net.calls.filter((c) => c.url.includes('postbox'))).toHaveLength(2);
  });

  it('сбой Postbox не роняет запрос (ошибка уходит в лог без адреса)', async () => {
    configureEmail({ transport: 'postbox', from: 'x <noreply@denvise.ru>' });
    const net = fakeNet(500);
    const logged: string[] = [];
    const orig = console.error;
    console.error = (m: string) => logged.push(String(m));
    try {
      await expect(sendEmail({ to: 'secret.person@example.com', subject: 's', text: 't' }, net.impl)).resolves.toBe(false); // не бросает, а сообщает, что не ушло
    } finally {
      console.error = orig;
    }
    expect(logged.join('\n')).toContain('*@example.com');
    expect(logged.join('\n')).not.toContain('secret.person');
  });
});

describe('настройки', () => {
  const base = { DATABASE_URL: 'postgres://x', BETTER_AUTH_SECRET: 'x'.repeat(32), BETTER_AUTH_URL: 'https://api.denvise.ru' };

  it('в production без Postbox ядро не стартует', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/EMAIL_TRANSPORT/);
  });

  const gateway = { GATEWAY_URL: 'https://gateway.example', GATEWAY_KEY: 'k'.repeat(32) };

  it('в production с Postbox и шлюзом — можно', () => {
    expect(loadEnv({ ...base, ...gateway, NODE_ENV: 'production', EMAIL_TRANSPORT: 'postbox' }).EMAIL_TRANSPORT).toBe('postbox');
  });

  it('в production без ключа шлюза ядро не стартует', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', EMAIL_TRANSPORT: 'postbox', GATEWAY_URL: gateway.GATEWAY_URL })).toThrow(/GATEWAY_KEY/);
  });
});
