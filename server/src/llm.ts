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
// за 1M токенов на июль 2026, подтверждено логами в сентябре 2026), 1M
// контекста — с запасом хватает на весь system-промпт (~43К токенов по
// данным OpenRouter) в каждом запросе. Qwen3.6 Plus — более сильная и чуть
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
  usage: {
    promptTokens: number;
    // Часть promptTokens, прочитанная из кеша провайдера (дешевле обычных).
    cachedTokens: number;
    completionTokens: number;
    totalTokens: number;
    // Итоговая стоимость запроса в USD по данным OpenRouter; null, если
    // OpenRouter её не прислал.
    costUsd: number | null;
  };
  model: string;
  // id генерации в OpenRouter — по нему запрос можно найти в Activity.
  generationId: string;
}

// OpenRouter всегда кладёт в usage поле cost (USD), но в типах openai-SDK
// его нет — читаем через узкий тип вместо any.
type OpenRouterUsage = { cost?: number };

// Какой раздел приложения вызвал модель — нужно, чтобы в логах расхода
// отделять ДентИИ от ИИ-Пациента.
export type LlmEndpoint = 'dentai' | 'patient';

/**
 * Универсальный вызов модели с произвольным system-промптом — используется
 * там, где нужен не фиксированный промпт ДентИИ, а свой на каждый случай
 * (например, ИИ-Пациент — свой промпт под каждую персону, см. index.ts).
 */
export async function askWithSystemPrompt(
  systemPrompt: string,
  history: ChatMessage[],
  options: { endpoint: LlmEndpoint; maxTokens?: number; temperature?: number }
): Promise<AskResult> {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Последнее сообщение в истории должно быть от пользователя (role: "user").');
  }

  const startedAt = Date.now();
  const completion = await client.chat.completions.create({
    model: MODEL,
    max_tokens: options.maxTokens ?? 300,
    // Для роли пациента температура повыше дефолтной ДентИИ (0.2) — тут
    // нужна живая, не «роботизированная» речь, а не точность цитирования.
    temperature: options.temperature ?? 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
  });

  const choice = completion.choices[0];
  const usage = completion.usage;
  const cost = (usage as OpenRouterUsage | undefined)?.cost;
  const result: AskResult = {
    answer: choice?.message?.content ?? '',
    finishReason: choice?.finish_reason ?? null,
    usage: {
      promptTokens: usage?.prompt_tokens ?? 0,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
      costUsd: typeof cost === 'number' ? cost : null,
    },
    model: completion.model,
    generationId: completion.id,
  };

  // Одна JSON-строка на каждый вызов модели — из них потом считаем реальную
  // экономику (см. MIGRATION-WEB.md §8). Текст диалога и данные клиента сюда
  // намеренно не пишем: шлюз не должен хранить ничего о пользователе.
  console.log(JSON.stringify({
    type: 'llm_usage',
    ts: new Date().toISOString(),
    endpoint: options.endpoint,
    model: result.model,
    generationId: result.generationId,
    promptTokens: result.usage.promptTokens,
    cachedTokens: result.usage.cachedTokens,
    completionTokens: result.usage.completionTokens,
    costUsd: result.usage.costUsd,
    latencyMs: Date.now() - startedAt,
    finishReason: result.finishReason,
  }));

  return result;
}

/**
 * Отправляет вопрос врача модели вместе со всей базой знаний (в system-
 * сообщении) и историей диалога.
 *
 * Про кеширование (замеры на DeepSeek V4 Flash, сентябрь 2026): DeepSeek
 * кеширует префикс промпта автоматически, без cache_control. Попадание в кеш
 * (~37К из ~43К токенов) снижает стоимость вопроса примерно в 4 раза:
 * ~$0.004 без кеша → ~$0.001 с кешем. Но попадание не гарантировано: кеш
 * живёт недолго и зависит от провайдера, к которому OpenRouter направил
 * запрос, — повтор через 10 минут в замере в кеш не попал. Поэтому экономику
 * считаем по цене без кеша, а реальную долю попаданий берём из логов
 * llm_usage (см. MIGRATION-WEB.md §8).
 */
export async function askDentAI(history: ChatMessage[]): Promise<AskResult> {
  return askWithSystemPrompt(systemPromptText, history, { endpoint: 'dentai', maxTokens: MAX_TOKENS, temperature: 0.2 });
}
