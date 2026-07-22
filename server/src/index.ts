import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { askDentAI, type ChatMessage } from './llm';
import { getChunkByNumber, getKnowledgeBaseStats } from './knowledgeBase';
import { checkCitations } from './citations';

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '256kb' }));

// Базовая защита от злоупотребления / случайного «залипания» клиента в цикле
// запросов. На MVP-масштабе этого достаточно; при росте — вынести на уровень
// API-шлюза/CDN.
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Подождите несколько минут.' },
});

const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

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
    const messages = req.body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Поле "messages" обязательно и должно быть непустым массивом.' });
    }
    if (messages.length > MAX_HISTORY_MESSAGES) {
      return res.status(400).json({ error: `Слишком длинная история диалога (максимум ${MAX_HISTORY_MESSAGES} сообщений). Начните новый чат.` });
    }

    const history: ChatMessage[] = [];
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return res.status(400).json({ error: 'Каждое сообщение должно иметь role: "user" | "assistant" и content: string.' });
      }
      if (m.content.length === 0 || m.content.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Сообщение пустое или длиннее ${MAX_MESSAGE_LENGTH} символов.` });
      }
      history.push({ role: m.role, content: m.content });
    }

    const lastMessage = history[history.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Последнее сообщение в истории должно быть от врача (role: "user").' });
    }

    const result = await askDentAI(history);
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
    res.status(502).json({ error: 'Не удалось получить ответ от ИИ-агента. Попробуйте ещё раз через минуту.' });
  }
});

app.listen(PORT, () => {
  const stats = getKnowledgeBaseStats();
  console.log(`ДентИИ сервер запущен на порту ${PORT}`);
  console.log(`База знаний: ${stats.totalChunks} источников (~${stats.approxTokens} токенов)`);
});
