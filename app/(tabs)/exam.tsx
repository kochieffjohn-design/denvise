import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { useScreenTransition } from '../../components/ScreenTransition';
import { C } from '../../constants/Colors';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { EXAM_CASES, type RecStep } from '../../data/examCases';
import { useProgress } from '../../lib/progress';
import { useRouter } from 'expo-router';
import { CORE_URL } from '../../constants/config';
import { useProContent } from '../../lib/content';
import { authEnabled } from '../../lib/session';

// ─── УТИЛИТЫ ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── ЭКРАН ───────────────────────────────────────────────────────────────────
export default function ExamScreen() {
  const { record } = useProgress();
  const headerTop = useHeaderTopPadding();
  const [caseIdx, setCaseIdx] = useState(() => Math.floor(Math.random() * EXAM_CASES.length));
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  // Phase 1 — анамнез
  const [askedQs, setAskedQs] = useState<string[]>([]);

  // Phase 2 — обследование
  const [usedMethods, setUsedMethods] = useState<string[]>([]);

  // Phase 3 — диагноз
  const [selDiag, setSelDiag] = useState('');
  const [diagConfirmed, setDiagConfirmed] = useState(false);

  // Phase 4 — тактика (нумерация шагов)
  const [stepOrder, setStepOrder] = useState<Record<string, number | null>>({});
  const [finished, setFinished] = useState(false);

  // Перемешанные варианты для этапов 3 и 4
  const [shuffDiag, setShuffDiag] = useState<string[]>([]);
  const [shuffSteps, setShuffSteps] = useState<RecStep[]>([]);

  const c = EXAM_CASES[caseIdx];

  // Перед экзаменом спрашиваем ядро: без Pro — один экзамен в день
  const pro = useProContent();
  const router = useRouter();
  const [started, setStarted] = useState(!authEnabled);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateMsg, setGateMsg] = useState('');
  const startExam = async () => {
    if (gateBusy) return;
    setGateBusy(true);
    setGateMsg('');
    try {
      const res = await fetch(`${CORE_URL}/api/exam/start`, { method: 'POST', credentials: 'include', signal: AbortSignal.timeout(8000) });
      if (res.ok) setStarted(true);
      else setGateMsg((await res.json().catch(() => null))?.error || 'Не удалось начать экзамен. Попробуйте ещё раз.');
    } catch {
      setStarted(true); // без сети не мешаем: кейсы экзамена есть на устройстве
    } finally {
      setGateBusy(false);
    }
  };

  const initCase = useCallback((idx: number) => {
    setCaseIdx(idx);
    setPhase(1);
    setAskedQs([]);
    setUsedMethods([]);
    setSelDiag('');
    setDiagConfirmed(false);
    setStepOrder({});
    setFinished(false);
    setShuffDiag(shuffle(EXAM_CASES[idx].diagOptions));
    setShuffSteps(shuffle(EXAM_CASES[idx].recSteps));
  }, []);

  const askQuestion = (id: string) => {
    if (!askedQs.includes(id)) setAskedQs(p => [...p, id]);
  };

  const applyMethod = (id: string) => {
    if (!usedMethods.includes(id)) setUsedMethods(p => [...p, id]);
  };

  const confirmDiag = () => {
    if (selDiag) setDiagConfirmed(true);
  };

  const setOrder = (stepId: string, order: number) => {
    setStepOrder(p => {
      const prev = { ...p };
      // Remove existing assignment of this order number
      Object.keys(prev).forEach(k => { if (prev[k] === order) prev[k] = null; });
      prev[stepId] = order;
      return prev;
    });
  };

 const submitTactics = () => {
  const score = anamScore + methodScore + diagScore + tacticScore;
  const xp = score >= 85 ? 120 : score >= 70 ? 90 : score >= 55 ? 60 : 30;
  record('exam', c.id, xp);
  setFinished(true);
};

  // ── Scoring ──────────────────────────────────────────────────────────────
  const keyQsAsked = c.anamnesisQuestions.filter(q => q.isKey && askedQs.includes(q.id)).length;
  const totalKeyQs = c.anamnesisQuestions.filter(q => q.isKey).length;
  const extraQs = askedQs.filter(id => !c.anamnesisQuestions.find(q => q.id === id)?.isKey).length;
  const anamScore = Math.max(0, Math.round(keyQsAsked / totalKeyQs * 20) - extraQs * 2);

  const reqMethods = c.methods.filter(m => m.isRequired);
  const usedReq = reqMethods.filter(m => usedMethods.includes(m.id)).length;
  const usedExtra = usedMethods.filter(id => !c.methods.find(m => m.id === id)?.isRequired).length;
  const methodScore = Math.max(0, Math.round(usedReq / reqMethods.length * 25) - usedExtra * 3);

  const diagScore = selDiag === c.correctDiag ? 30 : 0;

  const correctOrder = c.recSteps.reduce((acc, s) => { acc[s.id] = s.order; return acc; }, {} as Record<string, number>);
  const tacticScore = c.recSteps.reduce((acc, s) => {
    if (stepOrder[s.id] === s.order) return acc + Math.floor(25 / c.recSteps.length);
    return acc;
  }, 0);

  const total = anamScore + methodScore + diagScore + tacticScore;
  const grade = total >= 85 ? 'Отлично' : total >= 70 ? 'Хорошо' : total >= 55 ? 'Удовлетворительно' : 'Нужна практика';
  const gradeColor = total >= 85 ? C.success : total >= 70 ? '#f59e0b' : total >= 55 ? C.warn : C.danger;

  const allOrdered = c.recSteps.every(s => stepOrder[s.id] != null);

  // ─── ФИНАЛ ───────────────────────────────────────────────────────────────
  const t = useScreenTransition(!started ? 'gate' : finished ? 'result' : `case${caseIdx}-phase${phase}`, !started ? 0 : finished ? 5 : phase, { enterOnFocus: false }); // вкладка: вход анимирует таб-бар

  if (!started) return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrT}>Экзамен</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
        <View style={s.patBanner}>
          <Text style={s.patName}>Случайный клинический кейс</Text>
          <Text style={s.patComp}>Анамнез → обследование → диагноз → тактика. {EXAM_CASES.length} кейсов по разным специальностям.</Text>
        </View>
        {!pro.isPro && <Text style={s.gateNote}>Без Pro — один экзамен в день, с Pro — без ограничений.</Text>}
        {!!gateMsg && <Text style={s.gateErr}>{gateMsg}</Text>}
        <TouchableOpacity style={[s.btnP, gateBusy && { opacity: 0.6 }]} onPress={startExam} disabled={gateBusy}>
          <Text style={s.btnPT}>{gateBusy ? '…' : 'Начать экзамен'}</Text>
        </TouchableOpacity>
        {!!gateMsg && !pro.isPro && (
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Text style={s.gateLink}>Есть промокод? Введите его в Профиле</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );

  if (finished) return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrT}>Результат</Text>
        <View style={[s.specBadge, { backgroundColor: c.specialtyBg }]}>
          <Text style={[s.specBadgeT, { color: c.specialtyColor }]}>{c.specialty}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[s.resBanner, { borderColor: gradeColor }]}>
          <Text style={[s.resGrade, { color: gradeColor }]}>{grade}</Text>
          <Text style={s.resPct}>{total}<Text style={{ fontSize: 20, color: C.muted }}>/100</Text></Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardT}>Баллы по этапам</Text>
          {[
            { l: 'Анамнез', v: anamScore, max: 20 },
            { l: 'Обследование', v: methodScore, max: 25 },
            { l: 'Диагноз', v: diagScore, max: 30 },
            { l: 'Тактика', v: tacticScore, max: 25 },
          ].map((b, i) => (
            <View key={i} style={s.scoreRow}>
              <Text style={s.scoreL}>{b.l}</Text>
              <View style={s.scoreBar}>
                <View style={[s.scoreFill, { width: `${b.v / b.max * 100}%` as any, backgroundColor: b.v >= b.max * 0.6 ? C.success : C.danger }]} />
              </View>
              <Text style={[s.scoreV, { color: b.v >= b.max * 0.6 ? C.success : C.danger }]}>{b.v}/{b.max}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardT}>Правильный диагноз</Text>
          <Text style={s.diagCorrect}>{c.correctDiag}</Text>
          <Text style={s.diagReason}>{c.diagReason}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardT}>Правильная тактика по порядку</Text>
          {c.recSteps.sort((a, b) => a.order - b.order).map((st, i) => {
            const isOk = stepOrder[st.id] === st.order;
            return (
              <View key={st.id} style={s.tacticResultRow}>
                <View style={[s.tacticNum, { backgroundColor: isOk ? '#E8F5E9' : '#FFEBEE' }]}>
                  <Text style={[s.tacticNumT, { color: isOk ? C.success : C.danger }]}>{st.order}</Text>
                </View>
                <Text style={s.tacticResultT}>{st.text}</Text>
                <Ionicons name={isOk ? 'checkmark-circle' : 'close-circle'} size={18} color={isOk ? C.success : C.danger} />
              </View>
            );
          })}
        </View>

        <View style={[s.sourceRow]}>
          <Ionicons name="book-outline" size={14} color={C.muted} />
          <Text style={s.sourceT}>{c.source}</Text>
        </View>

        <TouchableOpacity style={s.btnP} onPress={() => { initCase(Math.floor(Math.random() * EXAM_CASES.length)); setStarted(!authEnabled); }}>
          <Text style={s.btnPT}>Новый случайный кейс</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  // ─── ОСНОВНОЙ ЭКРАН ───────────────────────────────────────────────────────
  const phases = ['Анамнез', 'Обследование', 'Диагноз', 'Тактика'];

  return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrT}>Экзамен</Text>
        <View style={[s.specBadge, { backgroundColor: c.specialtyBg }]}>
          <Text style={[s.specBadgeT, { color: c.specialtyColor }]}>{c.specialty}</Text>
        </View>
      </View>

      {/* Прогресс */}
      <View style={s.phaseBar}>
        {phases.map((p, i) => (
          <View key={i} style={[s.phaseStep, phase === i + 1 && s.phaseActive, phase > i + 1 && s.phaseDone]}>
            <Text style={[s.phaseT, (phase === i + 1 || phase > i + 1) && { color: C.white }]}>
              {phase > i + 1 ? '✓' : i + 1}
            </Text>
          </View>
        ))}
      </View>
      <View style={s.phaseLabelRow}>
        {phases.map((p, i) => (
          <Text key={i} style={[s.phaseLabel, phase === i + 1 && { color: C.primary, fontWeight: '700' }]}>{p}</Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>

        {/* Пациент */}
        <View style={s.patBanner}>
          <Text style={s.patName}>{c.patient.name}, {c.patient.age} лет</Text>
          <Text style={s.patComp}>{c.patient.chiefComplaint}</Text>
        </View>

        {/* ── ЭТАП 1: АНАМНЕЗ ───────────────────────────────────────── */}
        {phase === 1 && (
          <View style={s.card}>
            <Text style={s.cardT}>Соберите анамнез</Text>
            <Text style={s.cardHint}>Выберите вопросы которые нужно задать. Лишние вопросы снижают балл за этот этап.</Text>
            <View style={{ gap: 8 }}>
              {c.anamnesisQuestions.map(q => {
                const asked = askedQs.includes(q.id);
                return (
                  <TouchableOpacity key={q.id} style={[s.qBtn, asked && s.qBtnAsked]}
                    onPress={() => askQuestion(q.id)} activeOpacity={0.7}>
                    <Text style={[s.qBtnT, asked && { color: C.text }]}>{q.text}</Text>
                    {asked && <Ionicons name="chevron-down" size={14} color={C.primary} style={{ marginTop: 4 }} />}
                    {asked && <Text style={s.qAnswer}>{q.answer}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[s.btnP, { marginTop: 14, opacity: askedQs.length >= 3 ? 1 : 0.4 }]}
              onPress={() => setPhase(2)} disabled={askedQs.length < 3}>
              <Text style={s.btnPT}>Перейти к обследованию →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ЭТАП 2: ОБСЛЕДОВАНИЕ ──────────────────────────────────── */}
        {phase === 2 && (
          <View style={s.card}>
            <Text style={s.cardT}>Проведите обследование</Text>
            <Text style={s.cardHint}>Назначьте нужные методы. Лишние снижают балл — выбирайте обдуманно.</Text>
            <View style={{ gap: 8 }}>
              {c.methods.map(m => {
                const used = usedMethods.includes(m.id);
                return (
                  <TouchableOpacity key={m.id} style={[s.methodBtn, used && s.methodBtnUsed]}
                    onPress={() => applyMethod(m.id)} activeOpacity={0.7}>
                    <View style={s.methodTop}>
                      <Text style={[s.methodLabel, used && { color: C.primary }]}>{m.label}</Text>
                      {used && <View style={[s.methodDot, { backgroundColor: m.isRequired ? C.success : C.warn }]} />}
                    </View>
                    {used && <Text style={s.methodResult}>{m.result}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[s.btnP, { marginTop: 14, opacity: usedMethods.length >= 2 ? 1 : 0.4 }]}
              onPress={() => { setPhase(3); setShuffDiag(shuffle(c.diagOptions)); }} disabled={usedMethods.length < 2}>
              <Text style={s.btnPT}>Поставить диагноз →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ЭТАП 3: ДИАГНОЗ ───────────────────────────────────────── */}
        {phase === 3 && (
          <View style={s.card}>
            <Text style={s.cardT}>Поставьте диагноз по МКБ-10</Text>
            <Text style={s.cardHint}>На основе собранных данных выберите правильный диагноз.</Text>

            {/* Сводка данных */}
            <View style={s.summaryBox}>
              <Text style={s.summaryTitle}>Собранные данные</Text>
              {askedQs.map(id => {
                const q = c.anamnesisQuestions.find(q => q.id === id);
                return q ? <Text key={id} style={s.summaryItem}>· {q.answer}</Text> : null;
              })}
              {usedMethods.map(id => {
                const m = c.methods.find(m => m.id === id);
                return m ? <Text key={id} style={s.summaryItem}>· {m.result}</Text> : null;
              })}
            </View>

            {shuffDiag.map((d, i) => {
              let style = s.opt;
              if (diagConfirmed) {
                if (d === c.correctDiag) style = { ...s.opt, ...s.optOk };
                else if (d === selDiag) style = { ...s.opt, ...s.optNo };
              } else if (d === selDiag) {
                style = { ...s.opt, ...s.optSel };
              }
              return (
                <TouchableOpacity key={i} style={style}
                  onPress={() => !diagConfirmed && setSelDiag(d)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{d}</Text>
                </TouchableOpacity>
              );
            })}

            {!diagConfirmed ? (
              <TouchableOpacity style={[s.btnP, { marginTop: 12, opacity: selDiag ? 1 : 0.4 }]}
                onPress={confirmDiag} disabled={!selDiag}>
                <Text style={s.btnPT}>Подтвердить диагноз</Text>
              </TouchableOpacity>
            ) : (
              <>
                <View style={[s.reasonBox, { borderLeftColor: selDiag === c.correctDiag ? C.success : C.danger }]}>
                  <Text style={s.reasonT}>{c.diagReason}</Text>
                </View>
                <TouchableOpacity style={[s.btnP, { marginTop: 12 }]}
                  onPress={() => { setPhase(4); setShuffSteps(shuffle(c.recSteps)); }}>
                  <Text style={s.btnPT}>Далее — Тактика →</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── ЭТАП 4: ТАКТИКА ───────────────────────────────────────── */}
        {phase === 4 && (
          <View style={s.card}>
            <Text style={s.cardT}>Расставьте шаги тактики по порядку</Text>
            <Text style={s.cardHint}>Нажмите на цифру рядом с шагом чтобы назначить его порядковый номер. Цифры 1–{c.recSteps.length}.</Text>
            <View style={{ gap: 8 }}>
              {shuffSteps.map(st => {
                const assigned = stepOrder[st.id];
                return (
                  <View key={st.id} style={s.tacticRow}>
                    <View style={s.orderBtns}>
                      {Array.from({ length: c.recSteps.length }, (_, i) => i + 1).map(n => (
                        <TouchableOpacity key={n}
                          style={[s.orderBtn, assigned === n && { backgroundColor: C.primary }]}
                          onPress={() => setOrder(st.id, n)}>
                          <Text style={[s.orderBtnT, assigned === n && { color: C.white }]}>{n}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.tacticStepT}>{st.text}</Text>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={[s.btnP, { marginTop: 14, opacity: allOrdered ? 1 : 0.4 }]}
              onPress={submitTactics} disabled={!allOrdered}>
              <Text style={s.btnPT}>Завершить и получить результат</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── СТИЛИ ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    backgroundColor: C.dark,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hdrT: { color: C.white, fontSize: 18, fontWeight: '800', flex: 1 },
  specBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  specBadgeT: { fontSize: 12, fontWeight: '700' },
  phaseBar: { flexDirection: 'row', backgroundColor: C.dark, paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  phaseStep: { flex: 1, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  phaseActive: { backgroundColor: C.primary },
  phaseDone: { backgroundColor: C.success },
  phaseT: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' },
  phaseLabelRow: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  phaseLabel: { flex: 1, textAlign: 'center', fontSize: 10, color: C.muted, paddingVertical: 5, fontWeight: '500' },
  patBanner: { backgroundColor: C.dark, borderRadius: 14, padding: 16, marginBottom: 12 },
  patName: { color: C.white, fontSize: 16, fontWeight: '800', marginBottom: 6 },
  patComp: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  cardT: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 6 },
  cardHint: { fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 17 },
  qBtn: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12 },
  qBtnAsked: { backgroundColor: C.light, borderColor: C.primary },
  qBtnT: { fontSize: 13, color: C.text2, lineHeight: 18 },
  qAnswer: { fontSize: 13, color: C.text, marginTop: 8, lineHeight: 19 },
  methodBtn: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12 },
  methodBtnUsed: { backgroundColor: C.light, borderColor: C.primary },
  methodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodLabel: { fontSize: 13, fontWeight: '600', color: C.text2 },
  methodDot: { width: 8, height: 8, borderRadius: 4 },
  methodResult: { fontSize: 12, color: C.text2, marginTop: 8, lineHeight: 18 },
  summaryBox: { backgroundColor: '#F8FAFF', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  summaryItem: { fontSize: 12, color: C.text2, lineHeight: 18, marginBottom: 4 },
  opt: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 12, marginBottom: 8 },
  optSel: { backgroundColor: C.light, borderColor: C.primary },
  optOk: { backgroundColor: '#dcfce7', borderColor: C.success },
  optNo: { backgroundColor: '#fee2e2', borderColor: C.danger },
  reasonBox: { borderLeftWidth: 3, paddingLeft: 12, marginTop: 12, paddingVertical: 4 },
  reasonT: { fontSize: 13, color: C.text2, lineHeight: 19 },
  tacticRow: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, gap: 8 },
  orderBtns: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  orderBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  orderBtnT: { fontSize: 13, fontWeight: '700', color: C.text2 },
  tacticStepT: { fontSize: 13, color: C.text, lineHeight: 18 },
  resBanner: { backgroundColor: C.white, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 2, gap: 8 },
  resGrade: { fontSize: 24, fontWeight: '800' },
  resPct: { fontSize: 52, fontWeight: '900', color: C.text },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  scoreL: { fontSize: 13, color: C.text2, width: 110 },
  scoreBar: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreV: { fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' },
  diagCorrect: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 8 },
  diagReason: { fontSize: 13, color: C.text2, lineHeight: 20 },
  tacticResultRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  tacticNum: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tacticNumT: { fontSize: 12, fontWeight: '800' },
  tacticResultT: { flex: 1, fontSize: 13, color: C.text2, lineHeight: 18 },
  sourceRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', padding: 12, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  sourceT: { fontSize: 11, color: C.muted, flex: 1, lineHeight: 16 },
  gateNote: { fontSize: 13, color: C.n500, textAlign: 'center' },
  gateErr: { fontSize: 14, color: C.danger, textAlign: 'center', lineHeight: 20 },
  gateLink: { fontSize: 14, color: C.primary, fontWeight: '600', textAlign: 'center', paddingVertical: 6 },
  btnP: { backgroundColor: C.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnPT: { color: C.white, fontSize: 15, fontWeight: '700' },
});