import OpenAI from 'openai';
import { buildSystemPrompt } from './systemPrompt';

// API-ключ не может легитимно содержать пробельные символы — если при
// копипасте в Variables на Railway ключ случайно перенёсся на две строки
// (реальный \n оказался ВНУТРИ значения), обычный .trim() это не поймает —
// он чистит только края. Поэтому убираем пробельные символы целиком.
const apiKey = process.env.OPENROUTER_API_KEY?.replace(/\s+/g, '');
if (!apiKey) {
  // Намеренно падаем на старте, а не на первом запросе пользователя —
  // так ошибку конфигурации видно сразу в логах при деплое.
  throw new Error('OPENROUTER_API_KEY не задан. Скопируйте .env.example в .env и заполните ключ (получить на https://openrouter.ai/settings/keys).');
}

// OpenRouter отдаёт OpenAI-совместимый /v1/chat/completions, поэтому вместо
// отдельного SDK используем стандартный `openai`-клиент, просто указав ему
// другой baseURL. Модель выбирается через .env — можно переключаться между
// Qwen и DeepSeek без изменений кода.
const client = new OpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    // Не обязательны для работы API, но включают приложение в статистику
    // и рейтинги на openrouter.ai — полезно для отладки, кто есть кто.
    'HTTP-Referer': process.env.APP_URL || 'https://denvise.app',
    'X-Title': 'Denvise DentAI',
  },
});

// Модель для диалога. По умолчанию — DeepSeek V4 Flash: дёшево (~$0.09/$0.18
// за 1M токенов на июль 2026), 1M контекста — с запасом хватает на весь
// корпус (~53К токенов) в каждом запросе. Qwen3.6 Plus — более сильная и чуть
// дороже альтернатива, тоже с 1M контекстом. Переключается через .env без
// правки кода — см. .env.example, там оба варианта с актуальными на момент
// написания id и ценами. Проверяйте актуальность на openrouter.ai/models —
// провайдеры регулярно выпускают новые версии.
const MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
const MAX_TOKENS = 1024;

// System-промпт (правила + вся база знаний) не меняется между запросами —
// строим его один раз при старте процесса и переиспользуем.
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

/**
 * Универсальный вызов модели с произвольным system-промптом — используется
 * там, где нужен не фиксированный промпт ДентИИ, а свой на каждый случай
 * (например, ИИ-Пациент — свой промпт под каждую персону, см. index.ts).
 */
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
    // Для роли пациента температура повыше дефолтной ДентИИ (0.2) — тут
    // нужна живая, не «роботизированная» речь, а не точность цитирования.
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

/**
 * Отправляет вопрос врача модели вместе со всей базой знаний (в system-
 * сообщении) и историей диалога.
 *
 * Важно про кэширование: в отличие от прямого Anthropic API, explicit
 * prompt caching (cache_control) через OpenRouter официально гарантирован
 * только для моделей Anthropic — для Qwen/DeepSeek он не гарантирован
 * одинаково у всех провайдеров, через которых OpenRouter маршрутизирует
 * запрос. Но при текущем размере корпуса (~53К токенов) и ценах DeepSeek/
 * Qwen это не критично: даже БЕЗ кэша один запрос стоит доли цента (например,
 * на DeepSeek V4 Flash ~53K токенов input ≈ $0.005). Если корпус вырастёт на
 * порядок — вернуться к этому месту и пересчитать экономику.
 */
export async function askDentAI(history: ChatMessage[]): Promise<AskResult> {
  return askWithSystemPrompt(systemPromptText, history, { maxTokens: MAX_TOKENS, temperature: 0.2 });
}
