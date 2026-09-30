import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import {
  COMM_SCENARIOS,
  FORBIDDEN_WORDS,
  GOLDEN_WORDS,
  getQuizForStage,
  shuffleOptions,
  type CommQuizOption,
} from '../../data/clinicalData';
import { addXP } from '../../data/xpStorage';

type Scenario = typeof COMM_SCENARIOS[0];

const PSYCHO_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  'Тревожный / дентофоб':        { icon: 'heart-outline',         color: '#993556', bg: '#FBEAF0' },
  'Рациональный аналитик':       { icon: 'analytics-outline',     color: '#185FA5', bg: '#E6F1FB' },
  'Агрессивный / конфликтный':   { icon: 'flash-outline',         color: '#993C1D', bg: '#FAECE7' },
  'Пожилой с полиморбидностью':  { icon: 'accessibility-outline', color: '#5F5E5A', bg: '#F1EFE8' },
  'VIP / доминантный':           { icon: 'diamond-outline',       color: '#0C6E9E', bg: '#E6F4FB' },
  'Ребёнок — первый визит':      { icon: 'happy-outline',         color: '#2E7D32', bg: '#E8F5E9' },
  'Недоверчивый / «второе мнение»': { icon: 'search-outline',    color: '#534AB7', bg: '#EEEDFE' },
  'Пассивный / безразличный':    { icon: 'remove-circle-outline', color: '#854F0B', bg: '#FAEEDA' },
};

function PatientAvatar({ type }: { type: string }) {
  const ic = PSYCHO_ICONS[type] || { icon: 'person-outline', color: C.primary, bg: C.light };
  return (
    <View style={[s.avatar, { backgroundColor: ic.bg }]}>
      <Ionicons name={ic.icon as any} size={24} color={ic.color} />
    </View>
  );
}

export default function CommScreen() {
  const headerTop = useHeaderTopPadding();
  const [active, setActive] = useState<Scenario | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [tab, setTab] = useState<'patients' | 'forbidden' | 'golden'>('patients');

  // Квиз-состояние текущего этапа
  const [options, setOptions] = useState<CommQuizOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Итоги по сценарию
  const [correctFlags, setCorrectFlags] = useState<boolean[]>([]);
  const [scenarioDone, setScenarioDone] = useState(false);

  const loadStage = (sc: Scenario, idx: number) => {
    const quiz = getQuizForStage(sc.id, idx);
    setOptions(quiz ? shuffleOptions(quiz.options) : []);
    setSelectedIdx(null);
    setShowBreakdown(false);
  };

  const selectScenario = (sc: Scenario) => {
    setActive(sc);
    setStageIdx(0);
    setCorrectFlags([]);
    setScenarioDone(false);
    loadStage(sc, 0);
  };

  const reset = () => {
    setActive(null);
    setStageIdx(0);
    setSelectedIdx(null);
    setShowBreakdown(false);
    setCorrectFlags([]);
    setScenarioDone(false);
  };

  const pickOption = (idx: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    const isCorrect = options[idx]?.correct ?? false;
    setCorrectFlags(f => [...f, isCorrect]);
  };

  const nextStage = () => {
    if (!active) return;
    if (stageIdx < active.stages.length - 1) {
      const next = stageIdx + 1;
      setStageIdx(next);
      loadStage(active, next);
    } else {
      const correctCount = correctFlags.filter(Boolean).length;
      addXP(40 + correctCount * 10, 'comm');
      setScenarioDone(true);
    }
  };

  // ── ИТОГ СЦЕНАРИЯ ──
  const t = useScreenTransition(!active ? `list-${tab}` : scenarioDone ? 'result' : `scenario-${active.id}`, !active ? 0 : scenarioDone ? 2 : 1);

  if (active && scenarioDone) {
    const correctCount = correctFlags.filter(Boolean).length;
    const total = active.stages.length;
    const xp = 40 + correctCount * 10;
    const allCorrect = correctCount === total;
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <Text style={s.hdrTitle}>Приём завершён</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={[s.resBanner, { borderColor: allCorrect ? C.success : C.primary }]}>
            <Text style={[s.resTitle, { color: allCorrect ? C.success : C.primary }]}>
              {allCorrect ? 'Идеальный приём!' : 'Приём завершён'}
            </Text>
            <Text style={s.resDiag}>{active.name} · {active.type}</Text>
            <Text style={s.resScore}>{correctCount}/{total}</Text>
            <Text style={s.resScoreLabel}>верных ответов с первой попытки</Text>
            <Text style={s.resXp}>+{xp} XP</Text>
          </View>
          <TouchableOpacity style={s.btnP} onPress={reset}>
            <Text style={s.btnPT}>← К списку пациентов</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── ВНУТРИ СЦЕНАРИЯ ──
  if (active) {
    const stage = active.stages[stageIdx];
    const ic = PSYCHO_ICONS[active.type] || { icon: 'person-outline', color: C.primary, bg: C.light };
    const answered = selectedIdx !== null;
    const selectedOption = answered ? options[selectedIdx!] : null;

    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={reset} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={C.white} />
            <Text style={s.backT}>Назад</Text>
          </TouchableOpacity>
          <View style={[s.hdrAvatar, { backgroundColor: ic.bg }]}>
            <Ionicons name={ic.icon as any} size={18} color={ic.color} />
          </View>
          <Text style={s.hdrName} numberOfLines={1}>{active.name}</Text>
        </View>

        <View style={s.stageBar}>
          {active.stages.map((_, i) => (
            <View key={i} style={[s.stageDot,
              i === stageIdx && s.stageDotActive,
              i < stageIdx && s.stageDotDone,
            ]} />
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

          <View style={[s.goalBox, { borderLeftColor: ic.color }]}>
            <Text style={s.goalLabel}>ЭТАП {stageIdx + 1} · {stage.stage}</Text>
            <Text style={s.goalT}>{active.goal}</Text>
          </View>

          <View style={s.bodyCard}>
            <View style={s.bodyHeader}>
              <Ionicons name="body-outline" size={14} color={C.muted} />
              <Text style={s.bodyLabel}>Язык тела пациента</Text>
            </View>
            <Text style={s.bodyT}>{active.bodyLanguage}</Text>
          </View>

          <View style={s.patBubble}>
            <View style={[s.patBubbleIcon, { backgroundColor: ic.bg }]}>
              <Ionicons name={ic.icon as any} size={16} color={ic.color} />
            </View>
            <View style={s.patBubbleBody}>
              <Text style={s.patBubbleName}>{active.name}</Text>
              <Text style={s.patBubbleText}>{stage.patientSays}</Text>
            </View>
          </View>

          {/* Квиз-варианты */}
          {options.length > 0 && (
            <View style={{ gap: 10, marginBottom: 4 }}>
              <Text style={s.answerLabel}>Что вы ответите?</Text>
              {options.map((opt, i) => {
                let optStyle = s.optCard;
                if (answered) {
                  if (opt.correct) optStyle = { ...s.optCard, ...s.optOk };
                  else if (i === selectedIdx) optStyle = { ...s.optCard, ...s.optNo };
                  else optStyle = { ...s.optCard, ...s.optDim };
                }
                return (
                  <TouchableOpacity
                    key={i}
                    style={optStyle}
                    onPress={() => pickOption(i)}
                    disabled={answered}
                    activeOpacity={0.75}
                  >
                    <View style={s.optRow}>
                      <Text style={[
                        s.optText,
                        answered && !opt.correct && i !== selectedIdx && { color: C.muted },
                      ]}>
                        {opt.text}
                      </Text>
                      {answered && opt.correct && (
                        <Ionicons name="checkmark-circle" size={18} color={C.success} style={{ marginLeft: 8 }} />
                      )}
                      {answered && i === selectedIdx && !opt.correct && (
                        <Ionicons name="close-circle" size={18} color={C.danger} style={{ marginLeft: 8 }} />
                      )}
                    </View>
                    {answered && (opt.correct || i === selectedIdx) && (
                      <Text style={[
                        s.optExplain,
                        { color: opt.correct ? C.success : C.danger },
                      ]}>
                        {opt.explanation}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Разбор — открывается после ответа */}
          {answered && !showBreakdown && (
            <TouchableOpacity style={[s.btnP, { marginTop: 6 }]} onPress={() => setShowBreakdown(true)}>
              <Text style={s.btnPT}>Смотреть полный разбор →</Text>
            </TouchableOpacity>
          )}

          {answered && showBreakdown && (
            <View style={{ gap: 12, marginTop: 6 }}>
              <View style={s.hintsRow}>
                <View style={s.hintsBlock}>
                  <Text style={s.hintsLabel}>✓ Говорите</Text>
                  {stage.goodWords.map((w, i) => (
                    <View key={i} style={s.hintChip}>
                      <Text style={[s.hintChipT, { color: C.success }]}>{w}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.hintsBlock}>
                  <Text style={[s.hintsLabel, { color: C.danger }]}>✕ Избегайте</Text>
                  {stage.badWords.map((w, i) => (
                    <View key={i} style={[s.hintChip, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={[s.hintChipT, { color: C.danger }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={s.idealBox}>
                <View style={s.idealHeader}>
                  <Ionicons name="star" size={16} color={C.success} />
                  <Text style={s.idealLabel}>Развёрнутый эталонный ответ</Text>
                </View>
                <Text style={s.idealT}>{stage.ideal}</Text>
              </View>

              <TouchableOpacity
                style={[s.btnP, { backgroundColor: stageIdx < active.stages.length - 1 ? C.primary : C.success }]}
                onPress={nextStage}
              >
                <Text style={s.btnPT}>
                  {stageIdx < active.stages.length - 1 ? `Следующий этап (${stageIdx + 2}/${active.stages.length}) →` : 'Завершить приём'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── СПИСОК ──
  return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrTitle}>Коммуникация</Text>
      </View>

      <View style={s.tabRow}>
        {[
          { id: 'patients', label: 'Пациенты' },
          { id: 'forbidden', label: 'Запрещено' },
          { id: 'golden', label: 'Золотые фразы' },
        ].map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabActive]}
            onPress={() => setTab(t.id as any)}>
            <Text style={[s.tabT, tab === t.id && s.tabTActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'patients' && (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          {COMM_SCENARIOS.map(sc => {
            const ic = PSYCHO_ICONS[sc.type] || { icon: 'person-outline', color: C.primary, bg: C.light };
            return (
              <TouchableOpacity key={sc.id} style={s.patCard}
                onPress={() => selectScenario(sc)}
                activeOpacity={0.75}>
                <PatientAvatar type={sc.type} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.patName}>{sc.name}</Text>
                  <Text style={s.patType}>{sc.type}</Text>
                  <Text style={s.patGoal} numberOfLines={2}>{sc.goal}</Text>
                </View>
                <View style={[s.stagesCountWrap, { backgroundColor: ic.bg }]}>
                  <Text style={[s.stagesCountT, { color: ic.color }]}>{sc.stages.length} этапа</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {tab === 'forbidden' && (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionDesc}>Эти фразы разрушают доверие пациента мгновенно и безвозвратно.</Text>
          {FORBIDDEN_WORDS.map((fw, i) => (
            <View key={i} style={s.forbidCard}>
              <View style={s.forbidTop}>
                <View style={s.forbidDot} />
                <Text style={s.forbidWord}>{fw.word}</Text>
              </View>
              <Text style={s.forbidReason}>{fw.reason}</Text>
              <View style={s.altBox}>
                <Text style={s.altT}>{fw.alt}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {tab === 'golden' && (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          <Text style={s.sectionDesc}>Фразы которые работают в любой ситуации — строят доверие и снимают тревогу.</Text>
          {GOLDEN_WORDS.map((gw, i) => (
            <View key={i} style={s.goldenCard}>
              <View style={[s.goldenNum, { backgroundColor: C.light }]}>
                <Text style={[s.goldenNumT, { color: C.primary }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.goldenWord}>{gw.word}</Text>
                <Text style={s.goldenReason}>{gw.reason}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    backgroundColor: C.dark,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hdrTitle: { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  hdrName: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  hdrAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 13, fontWeight: '500' },
  stageBar: { flexDirection: 'row', gap: 6, backgroundColor: C.dark, paddingHorizontal: 18, paddingBottom: 12 },
  stageDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  stageDotActive: { backgroundColor: C.primary },
  stageDotDone: { backgroundColor: C.success },
  tabRow: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabT: { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTActive: { color: C.primary, fontWeight: '700' },
  patCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  patName: { fontSize: 15, fontWeight: '700', color: C.text },
  patType: { fontSize: 12, color: C.muted },
  patGoal: { fontSize: 12, color: C.text2, lineHeight: 17, marginTop: 2 },
  stagesCountWrap: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexShrink: 0, alignSelf: 'flex-start' },
  stagesCountT: { fontSize: 11, fontWeight: '700' },
  goalBox: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12, paddingVertical: 4 },
  goalLabel: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  goalT: { fontSize: 13, color: C.text2, lineHeight: 19 },
  bodyCard: { backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  bodyHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  bodyLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bodyT: { fontSize: 13, color: C.text2, lineHeight: 19, fontStyle: 'italic' },
  patBubble: { flexDirection: 'row', gap: 10, marginBottom: 14, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  patBubbleIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  patBubbleBody: { flex: 1, gap: 4 },
  patBubbleName: { fontSize: 12, fontWeight: '700', color: C.text },
  patBubbleText: { fontSize: 13, color: C.text2, lineHeight: 19 },
  answerLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 4 },
  optCard: {
    backgroundColor: C.white, borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    padding: 14,
  },
  optOk: { backgroundColor: '#F0FDF4', borderColor: C.success },
  optNo: { backgroundColor: '#FEF2F2', borderColor: C.danger },
  optDim: { opacity: 0.5 },
  optRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  optText: { fontSize: 13, color: C.text, lineHeight: 19, flex: 1 },
  optExplain: { fontSize: 12, lineHeight: 17, marginTop: 8, fontStyle: 'italic' },
  hintsRow: { flexDirection: 'row', gap: 10 },
  hintsBlock: { flex: 1, gap: 6 },
  hintsLabel: { fontSize: 11, fontWeight: '700', color: C.success, letterSpacing: 0.3, marginBottom: 2 },
  hintChip: { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  hintChipT: { fontSize: 11, fontWeight: '500', lineHeight: 16 },
  idealBox: { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#86EFAC' },
  idealHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  idealLabel: { fontSize: 12, fontWeight: '700', color: C.success },
  idealT: { fontSize: 13, color: C.text2, lineHeight: 20 },
  forbidCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: C.border },
  forbidTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forbidDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, flexShrink: 0 },
  forbidWord: { fontSize: 14, fontWeight: '700', color: C.danger, flex: 1 },
  forbidReason: { fontSize: 13, color: C.text2, lineHeight: 18 },
  altBox: { backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10 },
  altT: { fontSize: 13, color: C.success, lineHeight: 18 },
  goldenCard: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: C.border },
  goldenNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  goldenNumT: { fontSize: 14, fontWeight: '800' },
  goldenWord: { fontSize: 14, fontWeight: '700', color: C.text },
  goldenReason: { fontSize: 13, color: C.muted, lineHeight: 18 },
  sectionDesc: { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 4 },
  btnP: { backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPT: { color: C.white, fontSize: 14, fontWeight: '700' },
  resBanner: { backgroundColor: C.white, borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 2 },
  resTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  resDiag: { fontSize: 13, color: C.text2, marginBottom: 16 },
  resScore: { fontSize: 44, fontWeight: '900', color: C.text },
  resScoreLabel: { fontSize: 12, color: C.muted, marginBottom: 14 },
  resXp: { fontSize: 22, fontWeight: '800', color: C.primary },
});