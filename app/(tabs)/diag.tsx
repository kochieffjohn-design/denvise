import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { useScreenTransition } from '../../components/ScreenTransition';
import { C } from '../../constants/Colors';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { DIAG_CASES } from '../../data/clinicalData';
import { METHOD_RESULTS, REQUIRED_METHODS } from '../../data/diagMethods';
import { PRO_DIAG } from '../../data/proCatalog';
import { ProBadge } from '../../components/ProBadge';
import { onLockedPress, useProContent } from '../../lib/content';
import { useRouter } from 'expo-router';
import { useProgress } from '../../lib/progress';

type Level = 1 | 2 | 3;
type Phase = 'list' | 'complaint' | 'methods' | 'diagnosis' | 'result';

const LC: Record<number, string> = { 1: '#34d399', 2: '#f59e0b', 3: '#f87171' };
const LL: Record<number, string> = { 1: 'Начальный', 2: 'Средний', 3: 'Сложный' };

const METHODS = [
  { id: 'probing', label: 'Зондирование', key: 'probing' },
  { id: 'percussion', label: 'Перкуссия', key: 'percussion' },
  { id: 'thermo', label: 'Термодиагностика', key: 'thermo' },
  { id: 'eod', label: 'ЭОД', key: 'eod' },
  { id: 'xray', label: 'Рентгенснимок', key: 'xray' },
  { id: 'palpation', label: 'Пальпация', key: 'palpation' },
];


// Обследования: у Pro-кейсов — в самом кейсе (из ядра), у бесплатных — в data/diagMethods.ts
const requiredOf = (c: { id: string }): string[] => (c as any).requiredMethods ?? REQUIRED_METHODS[c.id] ?? [];
const resultsOf = (c: { id: string }): Record<string, string> => (c as any).methodResults ?? METHOD_RESULTS[c.id] ?? {};

const DIAG_DEPTH: Record<Phase, number> = { list: 0, complaint: 1, methods: 2, diagnosis: 3, result: 4 };

export default function DiagScreen() {
  const headerTop = useHeaderTopPadding();
  const [lvl, setLvl] = useState<Level>(1);
  const [phase, setPhase] = useState<Phase>('list');
  const [active, setActive] = useState<typeof DIAG_CASES[0] | null>(null);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [methodResults, setMethodResults] = useState<Record<string, string>>({});
  const [selDiag, setSelDiag] = useState('');
  const [diagAnswered, setDiagAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [diagOptions, setDiagOptions] = useState<string[]>([]);
  const [done, setDone] = useState<Record<string, { passed: boolean; xp: number }>>({});
  const { stats, record } = useProgress();
  const donePersisted = stats.diagDone;

  const pro = useProContent();
  const router = useRouter();
  const cases = [...DIAG_CASES, ...((pro.content?.diag ?? []) as typeof DIAG_CASES)].filter(c => c.level === lvl);
  const locked = pro.content ? [] : PRO_DIAG.filter(c => c.level === lvl);

  const startCase = (c: typeof DIAG_CASES[0]) => {
    setActive(c);
    setPhase('complaint');
    setSelectedMethods([]);
    setMethodResults({});
    setSelDiag('');
    setDiagAnswered(false);
    setScore(0);
  };

  const applyMethod = (methodId: string) => {
    if (!active || selectedMethods.includes(methodId)) return;
    const result = resultsOf(active)[methodId] || 'Данных нет.';
    setSelectedMethods(m => [...m, methodId]);
    setMethodResults(r => ({ ...r, [methodId]: result }));
  };

  const submitDiag = () => {
    if (!active || !selDiag) return;
    const correct = active.questions[0];
    const isCorrect = selDiag === correct.options[correct.correct];
    const required = requiredOf(active);
    const usedRequired = selectedMethods.filter(m => required.includes(m)).length;
    const usedExtra = selectedMethods.filter(m => !required.includes(m)).length;
    const methodScore = Math.max(0, Math.round(usedRequired / required.length * 30) - usedExtra * 5);
    const diagScore = isCorrect ? active.xp : 0;
    const total = methodScore + diagScore;
    const passed = isCorrect && usedRequired >= Math.ceil(required.length * 0.6);
    setScore(total);
    setDiagAnswered(true);
    setDone(d => ({ ...d, [active.id]: { passed, xp: total } }));
    if (passed) {
      record('diag', active.id, total);
    }
  };

  const reset = () => {
    setActive(null);
    setPhase('list');
    setSelectedMethods([]);
    setMethodResults({});
    setSelDiag('');
    setDiagAnswered(false);
    setScore(0);
  };

  // ── РЕЗУЛЬТАТ ──
  const t = useScreenTransition(`${phase}-${active?.id ?? ''}`, DIAG_DEPTH[phase]);

  if (phase === 'result' && active) {
    const d = done[active.id];
    const correct = active.questions[0];
    const required = requiredOf(active);
    const missed = required.filter(m => !selectedMethods.includes(m));
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={reset} style={s.back}><Text style={s.backT}>← К списку</Text></TouchableOpacity>
          <Text style={s.title}>Разбор кейса</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={[s.resBanner, { borderColor: d?.passed ? C.success : C.danger }]}>
            <Text style={[s.resTitle, { color: d?.passed ? C.success : C.danger }]}>
              {d?.passed ? 'Верно!' : 'Неверно'}
            </Text>
            <Text style={s.resDiag}>{active.diagnosis}</Text>
            <Text style={s.resXp}>+{d?.xp} XP</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Правильный диагноз</Text>
            <Text style={s.cardText}>{correct.options[correct.correct]}</Text>
            <Text style={[s.cardHint, { marginTop: 8 }]}>
              {selDiag === correct.options[correct.correct] ? correct.explanation.ok : correct.explanation.no}
            </Text>
          </View>

          {missed.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Методы которые стоило применить</Text>
              {missed.map(m => {
                const method = METHODS.find(me => me.id === m);
                return (
                  <View key={m} style={s.missedRow}>
                    <Text style={s.missedDot}>·</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.missedLabel}>{method?.label}</Text>
                      <Text style={s.missedResult}>{resultsOf(active)[m]}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={s.card}>
            <Text style={s.cardTitle}>Объективные данные</Text>
            {active.symptoms.map((sym, i) => (
              <View key={i} style={s.symRow}>
                <View style={[s.dot, { backgroundColor: sym.type === 'pos' ? C.success : sym.type === 'neg' ? C.danger : C.primary }]}>
                  <Text style={{ color: C.white, fontSize: 10, fontWeight: '700' }}>
                    {sym.type === 'pos' ? '+' : sym.type === 'neg' ? '−' : '?'}
                  </Text>
                </View>
                <Text style={s.symT}>{sym.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.btnP} onPress={reset}>
            <Text style={s.btnPT}>← К списку кейсов</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── ДИАГНОЗ ──
  if (phase === 'diagnosis' && active) {
    const correct = active.questions[0];
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={reset} style={s.back}><Text style={s.backT}>← Выход</Text></TouchableOpacity>
          <Text style={s.title}>Поставьте диагноз</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
          <View style={s.patBanner}>
            <Text style={s.patName}>{active.patient.name}</Text>
            <Text style={s.patComp}>{active.patient.complaint}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Данные обследования</Text>
            {Object.entries(methodResults).map(([key, val]) => {
              const method = METHODS.find(m => m.id === key);
              return (
                <View key={key} style={s.resultRow}>
                  <Text style={s.resultLabel}>{method?.label}:</Text>
                  <Text style={s.resultVal}>{val}</Text>
                </View>
              );
            })}
            {selectedMethods.length === 0 && (
              <Text style={{ color: C.muted, fontSize: 13 }}>Вы не применили ни одного метода</Text>
            )}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Диагноз по МКБ-10</Text>
            <Text style={s.cardHint}>Выберите один вариант:</Text>
            {diagOptions.map((opt, i) => {
              let style = s.opt;
              if (diagAnswered) {
                if (opt === correct.options[correct.correct]) style = { ...s.opt, ...s.optOk };
                else if (opt === selDiag) style = { ...s.opt, ...s.optNo };
              } else if (opt === selDiag) {
                style = { ...s.opt, ...s.optSel };
              }
              return (
                <TouchableOpacity key={i} style={style} onPress={() => !diagAnswered && setSelDiag(opt)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, color: C.text, lineHeight: 18 }}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!diagAnswered ? (
            <TouchableOpacity style={[s.btnP, { opacity: selDiag ? 1 : 0.4 }]} onPress={submitDiag} disabled={!selDiag}>
              <Text style={s.btnPT}>Подтвердить диагноз</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btnP} onPress={() => setPhase('result')}>
              <Text style={s.btnPT}>Смотреть разбор →</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── МЕТОДЫ ОБСЛЕДОВАНИЯ ──
  if (phase === 'methods' && active) {
    const required = requiredOf(active);
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={reset} style={s.back}><Text style={s.backT}>← Выход</Text></TouchableOpacity>
          <Text style={s.title}>Обследование</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
          <View style={s.patBanner}>
            <Text style={s.patName}>{active.patient.name}</Text>
            <Text style={s.patComp}>{active.patient.complaint}</Text>
            <Text style={s.patAnam}>{active.patient.anamnesis}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Выберите методы обследования</Text>
            <Text style={s.cardHint}>Применяйте только нужные — лишние снизят балл</Text>
            <View style={s.methodsGrid}>
              {METHODS.map(m => {
                const used = selectedMethods.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.methodBtn, used && s.methodBtnUsed]}
                    onPress={() => applyMethod(m.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.methodBtnT, used && s.methodBtnTUsed]}>{m.label}</Text>
                    {used && <Text style={s.methodCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {Object.entries(methodResults).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Результаты</Text>
              {Object.entries(methodResults).map(([key, val]) => {
                const method = METHODS.find(m => m.id === key);
                const isRequired = required.includes(key);
                return (
                  <View key={key} style={[s.resultRow, { borderLeftColor: isRequired ? C.success : C.warn, borderLeftWidth: 3, paddingLeft: 10 }]}>
                    <Text style={s.resultLabel}>{method?.label}:</Text>
                    <Text style={s.resultVal}>{val}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={[s.btnP, { opacity: selectedMethods.length > 0 ? 1 : 0.4 }]}
            onPress={() => {
              setDiagOptions([...active.questions[0].options].sort(() => Math.random() - 0.5));
              setPhase('diagnosis');
            }}
            disabled={selectedMethods.length === 0}
          >
            <Text style={s.btnPT}>Перейти к диагнозу →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── ЖАЛОБЫ ──
  if (phase === 'complaint' && active) {
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={reset} style={s.back}><Text style={s.backT}>← Назад</Text></TouchableOpacity>
          <Text style={s.title}>Первичный осмотр</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 14 }}>
          <View style={[s.levelTag, { backgroundColor: LC[active.level] + '22' }]}>
            <Text style={[s.levelTagT, { color: LC[active.level] }]}>{LL[active.level]} уровень</Text>
          </View>

          <View style={s.patBanner}>
            <Text style={s.patName}>{active.patient.name}</Text>
            <Text style={s.patComp}>{active.patient.complaint}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Анамнез</Text>
            <Text style={s.cardText}>{active.patient.anamnesis}</Text>
          </View>

          <View style={[s.card, { backgroundColor: C.light, borderColor: C.primary, borderWidth: 1 }]}>
            <Text style={{ fontSize: 13, color: C.primary, lineHeight: 19 }}>
              Изучите жалобы и анамнез. На следующем шаге вы выберете методы обследования — только нужные дадут нужную информацию.
            </Text>
          </View>

          <TouchableOpacity style={s.btnP} onPress={() => setPhase('methods')}>
            <Text style={s.btnPT}>Перейти к обследованию →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── СПИСОК КЕЙСОВ ──
  return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.title}>Диагностический тренажёр</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={s.levelRow}>
          {([1, 2, 3] as Level[]).map(l => (
            <TouchableOpacity
              key={l}
              style={[s.lvlBtn, lvl === l && { backgroundColor: LC[l] }]}
              onPress={() => setLvl(l)}
            >
              <Text style={[s.lvlBtnT, lvl === l && { color: C.white }]}>{LL[l]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.sectionHint}>
          {lvl === 1 ? 'Классические нозологии — отработайте базу' :
           lvl === 2 ? 'Сложнее — требуется дифференциальная диагностика' :
           'Ловушки — похожие симптомы, нетипичное течение'}
        </Text>

        <View style={{ gap: 10, marginTop: 8 }}>
          {cases.map(c => {
            const d = done[c.id];
            const isPersisted = donePersisted.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[s.caseCard, (d?.passed || isPersisted) && s.caseDone, d && !d.passed && s.caseFail]}
                onPress={() => startCase(c)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.caseName}>Пациент {c.patient.name}</Text>
                  <Text style={s.caseComp} numberOfLines={2}>{c.patient.complaint}</Text>
                </View>
                {d ? (
                  <Text style={[s.caseXp, { color: d.passed ? C.success : C.danger }]}>
                    {d.passed ? `+${d.xp}` : '↺'}
                  </Text>
                ) : isPersisted ? (
                  <Text style={[s.caseXp, { color: C.success }]}>✓</Text>
                ) : (
                  <Text style={s.caseArrow}>→</Text>
                )}
              </TouchableOpacity>
            );
          })}
          {locked.map(c => (
            <TouchableOpacity key={c.id} style={[s.caseCard, s.caseLocked]} onPress={() => onLockedPress(pro, () => router.push('/profile'))} activeOpacity={0.7}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.caseName}>Пациент {c.patient}</Text>
                <ProBadge />
              </View>
              <Text style={s.caseArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  caseLocked: { opacity: 0.75 },
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    backgroundColor: C.dark,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  back: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 12 },
  levelRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  lvlBtn: { flex: 1, backgroundColor: C.white, borderRadius: 20, paddingVertical: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  lvlBtnT: { fontSize: 12, fontWeight: '600', color: C.text2 },
  sectionHint: { fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 4 },
  caseCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    elevation: 1,
    borderLeftWidth: 3,
    borderLeftColor: C.border,
  },
  caseDone: { borderLeftColor: C.success },
  caseFail: { borderLeftColor: C.danger },
  caseName: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
  caseComp: { fontSize: 12, color: C.muted, lineHeight: 17 },
  caseXp: { fontSize: 16, fontWeight: '800' },
  caseArrow: { fontSize: 18, color: C.muted },
  levelTag: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  levelTagT: { fontSize: 12, fontWeight: '700' },
  patBanner: { backgroundColor: C.dark, borderRadius: 12, padding: 16 },
  patName: { color: C.white, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  patComp: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
  patAnam: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginTop: 6 },
  card: { backgroundColor: C.white, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 8 },
  cardText: { fontSize: 13, color: C.text2, lineHeight: 19 },
  cardHint: { fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 17 },
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  methodBtn: {
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodBtnUsed: { backgroundColor: C.light, borderColor: C.primary },
  methodBtnT: { fontSize: 13, color: C.text2, fontWeight: '500' },
  methodBtnTUsed: { color: C.primary, fontWeight: '700' },
  methodCheck: { fontSize: 12, color: C.primary, fontWeight: '700' },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 3 },
  resultLabel: { fontSize: 12, fontWeight: '700', color: C.text },
  resultVal: { fontSize: 13, color: C.text2, lineHeight: 18 },
  opt: { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 8 },
  optSel: { backgroundColor: C.light, borderColor: C.primary },
  optOk: { backgroundColor: '#dcfce7', borderColor: C.success },
  optNo: { backgroundColor: '#fee2e2', borderColor: C.danger },
  symRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  symT: { fontSize: 12, color: C.text2, flex: 1 },
  missedRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  missedDot: { color: C.danger, fontSize: 18, fontWeight: '700' },
  missedLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  missedResult: { fontSize: 12, color: C.muted, lineHeight: 17 },
  resBanner: { backgroundColor: C.white, borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2 },
  resTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  resDiag: { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: 8 },
  resXp: { fontSize: 36, fontWeight: '900', color: C.primary },
  btnP: { backgroundColor: C.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  btnPT: { color: C.white, fontSize: 14, fontWeight: '700' },
});