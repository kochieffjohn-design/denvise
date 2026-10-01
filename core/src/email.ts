// Отправка писем. Сейчас — только вывод в консоль (разработка и тесты).
// В проде здесь будет Yandex Cloud Postbox; до его подключения ядро в проде
// не запустится (см. assertEmailConfigured).

export type Email = { to: string; subject: string; text: string };

/** Последние письма — для тестов и локальной отладки. */
export const sentEmails: Email[] = [];

export async function sendEmail(email: Email): Promise<void> {
  sentEmails.push(email);
  if (sentEmails.length > 50) sentEmails.shift();
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] → ${email.to}: ${email.subject}\n${email.text}\n`);
  }
}

export function assertEmailConfigured(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error('Отправка писем в проде ещё не подключена (Postbox) — запуск в production запрещён.');
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
