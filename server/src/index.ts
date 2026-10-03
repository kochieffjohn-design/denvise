import cors from 'cors';
import 'dotenv/config';
import express, { type Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { PATIENTS } from '../data/patients';
import { checkCitations } from './citations';
import { getChunkByNumber, getKnowledgeBaseStats } from './knowledgeBase';
import { askDentAI, askWithSystemPrompt, type ChatMessage } from './llm';
import { monitorEnabled, notify, reportLlm, startMonitor } from './monitor';

const app = express();
const PORT = Number(process.env.PORT) || 8787;

// Railway (как и большинство PaaS) стоит за реверс-прокси и передаёт реальный
// IP клиента через X-Forwarded-For. Без этой настройки express-rate-limit не
// может надёжно определить, кто есть кто, и явно предупреждает об этом в логах.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

// Ядро (Yandex Cloud) представляется секретным ключом. Все его запросы идут
// с одного IP, поэтому лимит по IP к ним не применяется — лимиты на каждого
// пользователя считает ядро. GATEWAY_REQUIRE_KEY=1 — запросы без ключа
// отклоняются (включить, когда напрямую к шлюзу не ходит ни одно приложение).
const GATEWAY_KEY = process.env.GATEWAY_KEY || '';
const REQUIRE_KEY = process.env.GATEWAY_REQUIRE_KEY === '1';
if (REQUIRE_KEY && !GATEWAY_KEY) throw new Error('GATEWAY_REQUIRE_KEY=1 без GATEWAY_KEY');

function fromCore(req: Request): boolean {
  const got = req.get('x-gateway-key');
  if (!GATEWAY_KEY || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(GATEWAY_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

app.use('/api', (req, res, next) => {
  if (REQUIRE_KEY && !fromCore(req)) return res.status(403).json({ error: 'Доступ только через приложение Denvise.' });
  next();
});

// Базовая защита от злоупотребления / случайного «залипания» клиента в цикле
// запросов. На MVP-масштабе этого достаточно; при росте — вынести на уровень
// API-шлюза/CDN.
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: fromCore,
  message: { error: 'Слишком много запросов. Подождите несколько минут.' },
});

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Общая валидация истории чата — используется и ДентИИ, и ИИ-Пациентом.
 * Возвращает либо готовый массив ChatMessage, либо текст ошибки для 400-ответа.
 */
function parseHistory(messages: unknown): ChatMessage[] | { error: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'Поле "messages" обязательно и должно быть непустым массивом.' };
  }
  if (messages.length > MAX_HISTORY_MESSAGES) {
    return { error: `Слишком длинная история диалога (максимум ${MAX_HISTORY_MESSAGES} сообщений). Начните новый чат.` };
  }

  const history: ChatMessage[] = [];
  for (const m of messages as any[]) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { error: 'Каждое сообщение должно иметь role: "user" | "assistant" и content: string.' };
    }
    if (m.content.length === 0 || m.content.length > MAX_MESSAGE_LENGTH) {
      return { error: `Сообщение пустое или длиннее ${MAX_MESSAGE_LENGTH} символов.` };
    }
    history.push({ role: m.role, content: m.content });
  }

  const lastMessage = history[history.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return { error: 'Последнее сообщение в истории должно быть от пользователя (role: "user").' };
  }

  return history;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, knowledgeBase: getKnowledgeBaseStats() });
});

// Отдаёт ПОЛНЫЙ, неизменённый текст конкретного источника по его номеру —
// тому самому, что модель указывает в "Источники: #N". Это позволяет врачу
// открыть исходный протокол/случай и сверить самому, а не верить пересказу
// модели на слово. Технически самая надёжная защита от галлюцинаций —
// не автоматическая проверка, а прямая возможность проверить руками.
app.get('/api/dentai/source/:number', (req, res) => {
  const n = Number(req.params.number);
  if (!Number.isInteger(n) || n < 1) {
    return res.status(400).json({ error: 'Номер источника должен быть положительным целым числом.' });
  }
  const chunk = getChunkByNumber(n);
  if (!chunk) {
    return res.status(404).json({ error: `Источник #${n} не найден.` });
  }
  res.json({ number: n, source: chunk.source, title: chunk.title, text: chunk.text });
});

app.post('/api/dentai/ask', limiter, async (req, res) => {
  try {
    const history = parseHistory(req.body?.messages);
    if ('error' in history) {
      return res.status(400).json({ error: history.error });
    }
    const lastMessage = history[history.length - 1]!;

    const result = await askDentAI(history);
    reportLlm(true);
    const checked = checkCitations(result.answer);

    if (checked.invalidNumbers.length > 0) {
      // Модель сослалась на номер, которого нет в базе — по определению
      // придуманная ссылка. Не показываем её врачу молча, а логируем для
      // разбора: часто повторяющиеся случаи — сигнал, что промпт или модель
      // требуют доработки.
      console.warn('[dentai/ask] модель сослалась на несуществующие номера источников:', {
        invalidNumbers: checked.invalidNumbers,
        question: lastMessage.content.slice(0, 200),
      });
    }
    if (checked.missingSourcesLine) {
      console.warn('[dentai/ask] ответ модели не содержит строки "Источники:" — нарушение формата system-промпта', {
        question: lastMessage.content.slice(0, 200),
      });
    }

    res.json({
      answer: checked.body,
      sources: checked.sources,
      // Хоть одна ссылка не подтвердилась или строка источников отсутствует —
      // сигнал "не доверяй этому ответу вслепую", который стоит показать врачу,
      // а не только записать в лог.
      flagged: checked.invalidNumbers.length > 0 || checked.missingSourcesLine,
      model: result.model,
      usage: result.usage,
    });
  } catch (err) {
    console.error('[dentai/ask] error:', err);
    reportLlm(false);
    res.status(502).json({ error: 'Не удалось получить ответ от ИИ-агента. Попробуйте ещё раз через минуту.' });
  }
});

// ИИ-Пациент: та же схема, что ДентИИ (свой бэкенд + OpenRouter вместо ключа,
// зашитого в мобильный клиент), но со своим system-промптом на каждую персону
// вместо базы знаний — эти промпты сейчас простые (см. data/patients.ts),
// без полной системы доверия/раскрытия информации из спеки — это сознательно
// оставлено на потом, сейчас цель — просто убрать ключ из клиента и завести
// диалог.
//
// Жёсткая защита роли: слабые 1-2-предложенческие промпты персон иногда
// "соскальзывают" — модель вместо реплики пациента начинает говорить как
// эксперт/врач, хвалить план лечения профессиональным тоном и т.д. Этот
// префикс приклеивается к любому промпту персоны и держит модель в роли.
const PATIENT_ROLE_GUARD = `Важно и обязательно: ты играешь ТОЛЬКО пациента, от первого лица, на приёме у стоматолога. Пользователь — это врач, а не ты. Ты НИКОГДА не переключаешься на роль врача: не хвалишь план лечения как эксперт, не подтверждаешь профессиональную правильность его слов, не даёшь клинических рекомендаций. Твои реплики — это то, что говорит именно пациент: вопрос, эмоция, сомнение, согласие, возражение — коротко и по-человечески, в характере своего психотипа. Никогда не пиши фразы вида "вы всё верно" или "приятно, когда пациент внимателен" — это ты и есть пациент, а не наблюдатель со стороны.`;

app.post('/api/patient/chat', limiter, async (req, res) => {
  try {
    const patientId = req.body?.patientId;
    const patient = (PATIENTS as any[]).find((p) => p.id === patientId);
    if (!patient) {
      return res.status(400).json({ error: `Неизвестный patientId: "${patientId}".` });
    }

    const history = parseHistory(req.body?.messages);
    if ('error' in history) {
      return res.status(400).json({ error: history.error });
    }

    const result = await askWithSystemPrompt(
      `${PATIENT_ROLE_GUARD}\n\n${patient.systemPrompt}`,
      history,
      { endpoint: 'patient', maxTokens: 900, temperature: 0.6 }
    );
    reportLlm(true);
    res.json({ answer: result.answer, model: result.model, usage: result.usage });
  } catch (err) {
    console.error('[patient/chat] error:', err);
    reportLlm(false);
    res.status(502).json({ error: 'Не удалось получить ответ от ИИ-пациента. Попробуйте ещё раз через минуту.' });
  }
});

// Тревоги ядра владельцу: из Yandex Cloud Telegram недоступен, ядро шлёт их сюда
app.post('/internal/alert', async (req, res) => {
  if (!fromCore(req)) return res.status(403).json({ error: 'Только для ядра.' });
  const text = req.body?.text;
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) return res.status(400).json({ error: 'Нужен text.' });
  if (!monitorEnabled) return res.status(503).json({ error: 'Telegram не настроен.' });
  const sent = await notify(`🖥 Ядро: ${text}`);
  res.status(sent ? 200 : 502).json({ ok: sent });
});

app.listen(PORT, () => {
  startMonitor();
  const stats = getKnowledgeBaseStats();
  console.log(`ДентИИ сервер запущен на порту ${PORT}`);
  console.log(`База знаний: ${stats.totalChunks} источников (~${stats.approxTokens} токенов)`);
});