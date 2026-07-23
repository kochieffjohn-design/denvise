import OpenAI from 'openai';
import { buildSystemPrompt } from './systemPrompt';

// API-ключ не может легитимно содержать пробельные символы — если при
// копипасте в Variables на Railway ключ случайно перенёсся на две строки
// (реальный \n оказался ВНУТРИ значения), обычный .trim() это не поймает —
// он чистит только края. Поэтому убираем пробельные символы целиком.
const apiKey = process.env.OPENROUTER_API_KEY?.replace(/\s+/g, '');
if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY не задан. Скопируйте .env.example в .env и заполните ключ (получить на https://openrouter.ai/settings/keys).');
}

const client = new OpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'https://denvise.app',
    'X-Title': 'Denvise DentAI',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
const MAX_TOKENS = 1024;

const systemPromptText = buildSystemPrompt();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskResult {
  answer: string;
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
}

export async function askWithSystemPrompt(
  systemPrompt: string,
  history: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<AskResult> {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Последнее сообщение в истории должно быть от пользователя (role: "user").');
  }

  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: options?.maxTokens ?? 300,
    temperature: options?.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
  });

  const choice = completion.choices[0];
  return {
    answer: choice?.message?.content ?? '',
    finishReason: choice?.finish_reason ?? null,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    },
    model: completion.model,
  };
}

export async function askDentAI(history: ChatMessage[]): Promise<AskResult> {
  return askWithSystemPrompt(systemPromptText, history, { maxTokens: MAX_TOKENS, temperature: 0.2 });
}
