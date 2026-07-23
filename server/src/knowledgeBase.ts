/**
 * База знаний ДентИИ.
 *
 * Принципиально: это НЕ обёртка над внешними учебниками — источник только
 * собственные структурированные данные проекта Denvise:
 *   - data/procedures.ts  — клинические протоколы (инструменты, шаги, предостережения)
 *   - data/diagCases.ts   — клинические случаи с дифференциальной диагностикой
 *   - data/consultData.ts — скрипты общения с пациентом
 *
 * Каждый файл данных не содержит React Native-специфичных импортов
 * (в отличие от xpStorage.ts), поэтому их можно безопасно импортировать
 * в этот Node.js-бэкенд напрямую — единый источник правды, без дублирования.
 *
 * Если позже корпус вырастет на порядок (сотни протоколов, реальные учебники),
 * этот модуль — то место, которое нужно будет заменить на настоящий
 * векторный поиск (embeddings + top-k retrieval). Пока корпус компактный,
 * весь он целиком передаётся модели в system-сообщении на каждый запрос —
 * это надёжнее (модель не может «не найти» нужный фрагмент), а на моделях
 * уровня DeepSeek/Qwen через OpenRouter даже без гарантированного prompt
 * caching это стоит доли цента за запрос (см. server/.env.example).
 */

import { PROCEDURES } from '../data/procedures';
import { DIAG_CASES } from '../data/diagCases';
import { CONSULT_SECTIONS } from '../data/consultData';

export type KBSource = 'procedures' | 'diagCases' | 'consultData';

export interface KBChunk {
  id: string;
  source: KBSource;
  title: string;
  text: string;
}

function buildProcedureChunks(): KBChunk[] {
  return (PROCEDURES as any[]).map((p, i) => {
    const stepsText = (p.steps ?? [])
      .map((s: any, idx: number) => `${idx + 1}. ${s.t}\n   Как делать: ${s.d}${s.c ? `\n   Важно/риски: ${s.c}` : ''}`)
      .join('\n');
    const text = [
      `Протокол: ${p.name}`,
      p.about ? `Описание: ${p.about}` : '',
      p.tools?.length ? `Инструменты: ${p.tools.join(', ')}` : '',
      stepsText ? `Шаги протокола:\n${stepsText}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      id: `procedures:${i}:${p.name}`,
      source: 'procedures' as const,
      title: p.name,
      text,
    };
  });
}

function buildDiagCaseChunks(): KBChunk[] {
  return (DIAG_CASES as any[]).map((c) => {
    const symptomsText = (c.symptoms ?? [])
      .map((s: any) => `- ${s.text}`)
      .join('\n');
    // Пояснения из вопросов содержат ценную дифференциально-диагностическую логику
    // (почему именно этот диагноз, чем отличается от похожих) — включаем их как
    // клиническое обоснование, а не как учебный квиз.
    const reasoning = (c.questions ?? [])
      .map((q: any) => q?.explanation?.ok)
      .filter(Boolean)
      .map((t: string) => `- ${t}`)
      .join('\n');

    const text = [
      `Клинический случай: ${c.name}`,
      `Итоговый диагноз (МКБ-10): ${c.diagnosis}`,
      c.patient?.complaint ? `Жалобы пациента: ${c.patient.complaint}` : '',
      c.patient?.anamnesis ? `Анамнез: ${c.patient.anamnesis}` : '',
      c.xrayFindings ? `Рентгенологическая картина (${c.xrayLabel ?? 'снимок'}): ${c.xrayFindings}` : '',
      c.eod ? `ЭОД: ${c.eod}` : '',
      symptomsText ? `Симптомы и признаки:\n${symptomsText}` : '',
      reasoning ? `Клиническое обоснование и дифференциальная диагностика:\n${reasoning}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      id: `diagCases:${c.id}:${c.name}`,
      source: 'diagCases' as const,
      title: `${c.name} (${c.diagnosis})`,
      text,
    };
  });
}

function buildConsultChunks(): KBChunk[] {
  const chunks: KBChunk[] = [];
  for (const section of CONSULT_SECTIONS as any[]) {
    for (const script of section.scripts ?? []) {
      const stepsText = (script.steps ?? [])
        .map((s: any, idx: number) => `${idx + 1}. ${s.label}: ${s.text}`)
        .join('\n');
      const objectionsText = (script.objections ?? [])
        .map((o: any) => `- Возражение «${o.q}» → ${o.a}`)
        .join('\n');

      const text = [
        `Скрипт общения с пациентом: ${script.title} (раздел: ${section.title})`,
        script.situation ? `Ситуация: ${script.situation}` : '',
        stepsText ? `Как вести разговор:\n${stepsText}` : '',
        objectionsText ? `Типичные возражения:\n${objectionsText}` : '',
        script.forbidden?.length ? `Нельзя говорить: ${script.forbidden.join('; ')}` : '',
        script.golden?.length ? `Рекомендованные формулировки: ${script.golden.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      chunks.push({
        id: `consultData:${script.id}:${script.title}`,
        source: 'consultData' as const,
        title: script.title,
        text,
      });
    }
  }
  return chunks;
}

let cachedChunks: KBChunk[] | null = null;

export function getKnowledgeBaseChunks(): KBChunk[] {
  if (!cachedChunks) {
    cachedChunks = [
      ...buildProcedureChunks(),
      ...buildDiagCaseChunks(),
      ...buildConsultChunks(),
    ];
  }
  return cachedChunks;
}

/**
 * Полный текст корпуса — вставляется в system-промпт целиком (см. systemPrompt.ts).
 * Каждый фрагмент пронумерован и помечен источником — модель обязана
 * ссылаться на конкретный номер/название при ответе.
 */
export function getFullCorpusText(): string {
  const chunks = getKnowledgeBaseChunks();
  return chunks
    .map((c, i) => `[[Источник #${i + 1} · ${c.source} · ${c.title}]]\n${c.text}`)
    .join('\n\n---\n\n');
}

/**
 * Источник по номеру — той же нумерации, что в getFullCorpusText() ([[Источник #N]]).
 * Используется сервером для проверки цитат модели (см. citations.ts): если модель
 * ссылается на номер, которого нет в этом диапазоне, это явный сигнал, что номер
 * придуман, а не реально взят из корпуса.
 */
export function getChunkByNumber(n: number): KBChunk | undefined {
  const chunks = getKnowledgeBaseChunks();
  return chunks[n - 1];
}

export function getKnowledgeBaseStats() {
  const chunks = getKnowledgeBaseChunks();
  const fullText = getFullCorpusText();
  return {
    totalChunks: chunks.length,
    bySource: {
      procedures: chunks.filter((c) => c.source === 'procedures').length,
      diagCases: chunks.filter((c) => c.source === 'diagCases').length,
      consultData: chunks.filter((c) => c.source === 'consultData').length,
    },
    totalChars: fullText.length,
    // грубая оценка токенов для кириллического текста (~2.2 символа/токен)
    approxTokens: Math.round(fullText.length / 2.2),
  };
}

// Позволяет запустить `npm run kb:stats` и сразу увидеть, что корпус собрался
// без «дыр» в массивах данных и посмотреть примерную стоимость system-промпта
// в токенах — полезно проверять после любой правки data/*.ts.
if (require.main === module) {
  const stats = getKnowledgeBaseStats();
  console.log('=== ДентИИ: статистика базы знаний ===');
  console.log(`Всего источников: ${stats.totalChunks}`);
  console.log(`  протоколов (procedures.ts):     ${stats.bySource.procedures}`);
  console.log(`  клинических случаев (diagCases.ts): ${stats.bySource.diagCases}`);
  console.log(`  скриптов общения (consultData.ts):  ${stats.bySource.consultData}`);
  console.log(`Размер корпуса: ${stats.totalChars} символов, ~${stats.approxTokens} токенов`);
  console.log('\nСписок источников:');
  for (const c of getKnowledgeBaseChunks()) {
    console.log(`  [${c.source}] ${c.title}`);
  }
}
