// Замер провайдеров модели ДентИИ на OpenRouter: время до первого слова без кеша и с кешем.
//   npx tsx scripts/providers.ts [провайдер ...]
import 'dotenv/config';
import { buildSystemPrompt } from '../src/systemPrompt';

const KEY = process.env.OPENROUTER_API_KEY!.replace(/\s+/g, '');
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
const system = buildSystemPrompt();
const PROVIDERS = process.argv.slice(2).length ? process.argv.slice(2) : ['deepinfra', 'baidu', 'streamlake', 'gmicloud', 'alibaba', 'siliconflow'];
const Q = 'Чем отличается К-файл от Н-файла?';

async function once(provider: string) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 300, temperature: 0.2, stream: true, usage: { include: true },
      provider: { order: [provider], allow_fallbacks: false },
      messages: [{ role: 'system', content: system }, { role: 'user', content: Q }],
    }),
  });
  if (!res.ok) return `ошибка ${res.status} ${(await res.text()).slice(0, 120)}`;
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let first = 0, buf = '', usage: any = null, prov = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      const j = JSON.parse(line.slice(6));
      prov ||= j.provider;
      if (j.choices?.[0]?.delta?.content && !first) first = Date.now() - t0;
      if (j.usage) usage = j.usage;
    }
  }
  const total = Date.now() - t0;
  return `${prov}: первое слово ${(first / 1000).toFixed(1)} с, всё ${(total / 1000).toFixed(1)} с, кеш ${usage?.prompt_tokens_details?.cached_tokens ?? '?'} из ${usage?.prompt_tokens}, $${usage?.cost?.toFixed(5)}`;
}

(async () => {
  for (const p of PROVIDERS) {
    console.log('холодный', await once(p).catch((e) => `ошибка ${e.message}`));
    await new Promise((r) => setTimeout(r, 3000));
    console.log('повтор  ', await once(p).catch((e) => `ошибка ${e.message}`));
  }
})();
