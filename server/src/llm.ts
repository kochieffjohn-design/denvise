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
const DENTAI_OPTIONS = { endpoint: 'dentai', maxTokens: MAX_TOKENS, temperature: 0.2 } as const;

// Параметры OpenRouter сверх OpenAI-формата (замеры октября 2026):
//  - reasoning выключен: DeepSeek V4 Flash по умолчанию сначала «думает» 200–500
//    токенов — это +3–4 с до первого слова, а на длинных ответах рассуждения
//    съедали max_tokens и ответ обрывался без строки «Источники:». На ответах по
//    базе знаний качество без рассуждений то же (сравнение на 4 вопросах);
//  - провайдер — с наименьшей задержкой: модель держат ~16 провайдеров, а
//    случайный выбор давал от 3 до 10 с до первого слова.
const ROUTING = { reasoning: { enabled: false }, provider: { sort: 'latency' } };

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

type CallOptions = { endpoint: LlmEndpoint; maxTokens?: number; temperature?: number };

function request(systemPrompt: string, history: ChatMessage[], options: CallOptions) {
  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Последнее сообщение в истории должно быть от пользователя (role: "user").');
  }
  return {
    model: MODEL,
    max_tokens: options.maxTokens ?? 300,
    // Для роли пациента температура повыше дефолтной ДентИИ (0.2) — тут
    // нужна живая, не «роботизированная» речь, а не точность цитирования.
    temperature: options.temperature ?? 0.7,
    messages: [
      { role: 'system' as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as const),
    ],
    ...ROUTING,
  };
}

function toUsage(usage: OpenAI.Completions.CompletionUsage | null | undefined): AskResult['usage'] {
  const cost = (usage as OpenRouterUsage | null | undefined)?.cost;
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    costUsd: typeof cost === 'number' ? cost : null,
  };
}

// Одна JSON-строка на каждый вызов модели — из них потом считаем реальную
// экономику (см. MIGRATION-WEB.md §8). Текст диалога и данные клиента сюда
// намеренно не пишем: шлюз не должен хранить ничего о пользователе.
function logUsage(endpoint: LlmEndpoint, result: AskResult, startedAt: number, firstTokenAt?: number) {
  console.log(JSON.stringify({
    type: 'llm_usage',
    ts: new Date().toISOString(),
    endpoint,
    model: result.model,
    generationId: result.generationId,
    promptTokens: result.usage.promptTokens,
    cachedTokens: result.usage.cachedTokens,
    completionTokens: result.usage.completionTokens,
    costUsd: result.usage.costUsd,
    latencyMs: Date.now() - startedAt,
    firstTokenMs: firstTokenAt === undefined ? undefined : firstTokenAt - startedAt,
    finishReason: result.finishReason,
  }));
}

/**
 * Универсальный вызов модели с произвольным system-промптом — используется
 * там, где нужен не фиксированный промпт ДентИИ, а свой на каждый случай
 * (например, ИИ-Пациент — свой промпт под каждую персону, см. index.ts).
 */
export async function askWithSystemPrompt(systemPrompt: string, history: ChatMessage[], options: CallOptions): Promise<AskResult> {
  const startedAt = Date.now();
  const completion = await client.chat.completions.create(request(systemPrompt, history, options));
  const choice = completion.choices[0];
  const result: AskResult = {
    answer: choice?.message?.content ?? '',
    finishReason: choice?.finish_reason ?? null,
    usage: toUsage(completion.usage),
    model: completion.model,
    generationId: completion.id,
  };
  logUsage(options.endpoint, result, startedAt);
  return result;
}

/**
 * То же, но ответ приходит по частям: onDelta получает каждый новый кусок
 * текста, как только модель его напечатала. signal — отмена, если
 * пользователь ушёл, не дождавшись ответа.
 */
export async function streamWithSystemPrompt(
  systemPrompt: string,
  history: ChatMessage[],
  options: CallOptions,
  onDelta: (text: string) => void,
  signal?: AbortSignal
): Promise<AskResult> {
  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  const stream = await client.chat.completions.create(
    { ...request(systemPrompt, history, options), stream: true, stream_options: { include_usage: true } },
    { signal }
  );
  let answer = '';
  let finishReason: string | null = null;
  let usage: OpenAI.Completions.CompletionUsage | undefined;
  let model = MODEL;
  let generationId = '';
  for await (const chunk of stream) {
    generationId ||= chunk.id;
    model = chunk.model || model;
    const choice = chunk.choices[0];
    const delta = choice?.delta?.content;
    if (delta) {
      firstTokenAt ??= Date.now();
      answer += delta;
      onDelta(delta);
    }
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (chunk.usage) usage = chunk.usage;
  }
  const result: AskResult = { answer, finishReason, usage: toUsage(usage), model, generationId };
  logUsage(options.endpoint, result, startedAt, firstTokenAt);
  return result;
}

/**
 * Отправляет вопрос врача модели вместе со всей базой знаний (в system-
 * сообщении) и историей диалога.
 *
 * Про кеширование (замеры на DeepSeek V4 Flash, сентябрь–октябрь 2026):
 * DeepSeek кеширует префикс промпта автоматически, без cache_control.
 * Попадание в кеш (~37К из ~43К токенов) снижает стоимость вопроса примерно
 * в 4 раза: ~$0.004 без кеша → ~$0.001 с кешем. Но попадание не
 * гарантировано: кеш у каждого провайдера свой. Время до первого слова кеш
 * почти не меняет — поэтому «прогревать» его ради скорости нет смысла.
 * Экономику считаем по цене без кеша, а реальную долю попаданий берём из
 * логов llm_usage (см. MIGRATION-WEB.md §8).
 */
export async function askDentAI(history: ChatMessage[]): Promise<AskResult> {
  return askWithSystemPrompt(systemPromptText, history, DENTAI_OPTIONS);
}

/** ДентИИ с ответом по частям (см. streamWithSystemPrompt). */
export function streamDentAI(history: ChatMessage[], onDelta: (text: string) => void, signal?: AbortSignal): Promise<AskResult> {
  return streamWithSystemPrompt(systemPromptText, history, DENTAI_OPTIONS, onDelta, signal);
}
