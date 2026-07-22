import { getChunkByNumber, getKnowledgeBaseChunks } from './knowledgeBase';

export interface VerifiedSource {
  number: number;
  source: string;
  title: string;
}

export interface CitationCheckResult {
  /** Текст ответа без последней строки "Источники: ...". */
  body: string;
  /** Источники, номера которых реально существуют в базе — безопасно показывать врачу. */
  sources: VerifiedSource[];
  /** Номера, которые модель назвала, но которых нет в базе (0 < n или n > totalChunks) —
   *  явный признак придуманной ссылки. В норме должно быть пусто. */
  invalidNumbers: number[];
  /** Модель не дала ни одной ссылки и не написала явно "Источники: нет" — ответ,
   *  скорее всего, не соответствует формату из system-промпта (нарушение инструкции
   *  само по себе стоит насторожить: если модель не соблюдает форму, где гарантия,
   *  что она держит и содержательные правила). */
  missingSourcesLine: boolean;
}

const SOURCES_LINE_RE = /Источники:\s*(.+)\s*$/i;

/**
 * Разбирает ответ модели и ОТДЕЛЬНО, на сервере, проверяет каждый номер
 * источника против реальной базы знаний — а не просто доверяет тексту, который
 * написала модель.
 *
 * Важно понимать границы этой проверки: она ловит только один класс ошибок —
 * ссылку на номер, которого не существует. Она НЕ проверяет, действительно ли
 * содержание ответа соответствует тексту источника с указанным номером (модель
 * может сослаться на реальный источник #12, но неточно передать его содержание).
 * Для такой более глубокой проверки нужен второй вызов модели-судьи, сверяющий
 * ответ с текстом источников — это осознанно не сделано в MVP (ещё один вызов =
 * ещё расход и задержка), но при появлении признаков реальных проблем — это
 * следующий шаг.
 */
export function checkCitations(rawAnswer: string): CitationCheckResult {
  const totalChunks = getKnowledgeBaseChunks().length;
  const match = rawAnswer.match(SOURCES_LINE_RE);

  if (!match) {
    return { body: rawAnswer.trim(), sources: [], invalidNumbers: [], missingSourcesLine: true };
  }

  const body = rawAnswer.slice(0, match.index).trim();
  const rawList = (match[1] ?? '').trim();

  if (/^нет\.?$/i.test(rawList)) {
    return { body, sources: [], invalidNumbers: [], missingSourcesLine: false };
  }

  const numbers = Array.from(rawList.matchAll(/#?(\d+)/g)).map((m) => Number(m[1] ?? NaN));

  const sources: VerifiedSource[] = [];
  const invalidNumbers: number[] = [];
  const seen = new Set<number>();

  for (const n of numbers) {
    if (seen.has(n)) continue;
    seen.add(n);

    if (!Number.isFinite(n) || n < 1 || n > totalChunks) {
      invalidNumbers.push(n);
      continue;
    }
    const chunk = getChunkByNumber(n);
    if (!chunk) {
      invalidNumbers.push(n);
      continue;
    }
    // Название источника берём из НАШЕЙ базы, а не из текста модели — даже если
    // модель попытается переформулировать или исказить название, врач увидит
    // ровно то, что реально лежит в data/*.ts.
    sources.push({ number: n, source: chunk.source, title: chunk.title });
  }

  return { body, sources, invalidNumbers, missingSourcesLine: false };
}
