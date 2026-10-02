// Отправка писем.
//   console — печать в консоль (разработка, тесты);
//   postbox — Yandex Cloud Postbox. Ключей доступа нет: машине назначен
//             сервисный аккаунт denvise-core (роль postbox.sender), временный
//             IAM-токен берётся из сервиса метаданных машины.

export type Email = { to: string; subject: string; text: string };
export type EmailTransport = 'console' | 'postbox';

/** Последние письма — для тестов и локальной отладки. */
export const sentEmails: Email[] = [];

type Config = { transport: EmailTransport; from: string };
let config: Config = { transport: 'console', from: 'Denvise <noreply@denvise.ru>' };

export function configureEmail(c: Config): void {
  config = c;
}

const POSTBOX_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
const METADATA_TOKEN_URL = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';

let cachedToken: { value: string; expiresAt: number } | null = null;

/** IAM-токен сервисного аккаунта машины; обновляется заранее, за 5 минут до истечения. */
async function iamToken(fetchImpl: typeof fetch): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60_000) return cachedToken.value;
  const res = await fetchImpl(METADATA_TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`metadata token: HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function sendViaPostbox(email: Email, fetchImpl: typeof fetch): Promise<void> {
  const token = await iamToken(fetchImpl);
  const res = await fetchImpl(POSTBOX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-YaCloud-SubjectToken': token },
    body: JSON.stringify({
      FromEmailAddress: config.from,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: email.text, Charset: 'UTF-8' } },
        },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`postbox: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
}

export async function sendEmail(email: Email, fetchImpl: typeof fetch = fetch): Promise<void> {
  sentEmails.push(email);
  if (sentEmails.length > 50) sentEmails.shift();
  if (config.transport === 'postbox') {
    try {
      await sendViaPostbox(email, fetchImpl);
    } catch (e) {
      // Не роняем запрос пользователя: письмо не ушло — он попросит код ещё раз.
      // Адрес в лог не пишем (персональные данные), только домен.
      console.error(`[email] не отправлено на *@${email.to.split('@')[1]}: ${(e as Error).message}`);
    }
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] → ${email.to}: ${email.subject}\n${email.text}\n`);
  }
}

export function otpEmail(code: string): Pick<Email, 'subject' | 'text'> {
  return {
    subject: `Код входа в Denvise: ${code}`,
    text: [
      `Ваш код для входа в Denvise: ${code}`,
      '',
      'Код действует 5 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.',
    ].join('\n'),
  };
}

/** Для тестов: сбросить кеш токена. */
export function resetEmailState(): void {
  cachedToken = null;
}
