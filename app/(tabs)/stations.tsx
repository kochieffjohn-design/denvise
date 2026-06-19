import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { C } from '../../constants/Colors';
import { STATIONS, type Station } from '../../data/clinicalData';

// ─── КОНСТРУКТОР ────────────────────────────────────────────
function StepBuilder({ station }: { station: Station }) {
  const allSteps = station.checklistGroups
    .filter(g => !g.title.startsWith('⚠️'))
    .flatMap(g => g.items);

  const [shuffled] = useState(() => [...allSteps].sort(() => Math.random() - 0.5));
  const [selected, setSelected] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const handleTap = (stepId: string) => {
    if (finished) return;
    if (selected.includes(stepId)) {
      setSelected(prev => prev.filter(id => id !== stepId));
      return;
    }
    const newSelected = [...selected, stepId];
    setSelected(newSelected);
    if (newSelected.length === allSteps.length) {
      setFinished(true);
    }
  };

  const getCorrectOrder = (stepId: string) => allSteps.findIndex(s => s.id === stepId) + 1;
  const getAssignedOrder = (stepId: string) => {
    const idx = selected.indexOf(stepId);
    return idx === -1 ? null : idx + 1;
  };

  const correctCount = finished
    ? selected.filter((id, idx) => getCorrectOrder(id) === idx + 1).length
    : 0;

  const reset = () => {
    setSelected([]);
    setFinished(false);
  };

  return (
    <View style={sb.container}>
      <View style={sb.header}>
        <Text style={sb.title}>Конструктор последовательности</Text>
        <Text style={sb.hint}>
          Нажимай шаги в правильном порядке — первый нажатый = шаг 1, второй = шаг 2 и т.д.
        </Text>
      </View>

      <View style={sb.progressRow}>
        <View style={sb.progressBg}>
          <View style={[sb.progressFill, {
            width: `${(selected.length / allSteps.length) * 100}%` as any,
            backgroundColor: finished ? C.success : C.primary,
          }]} />
        </View>
        <Text style={sb.progressLabel}>{selected.length}/{allSteps.length}</Text>
      </View>

      <View style={sb.stepsWrap}>
        {shuffled.map(step => {
          const assignedOrder = getAssignedOrder(step.id);
          const correctOrder = getCorrectOrder(step.id);
          const isSelected = assignedOrder !== null;
          const isCorrect = finished && assignedOrder === correctOrder;
          const isWrong = finished && isSelected && assignedOrder !== correctOrder;

          let cardStyle = sb.stepCard;
          if (isCorrect) cardStyle = { ...sb.stepCard, ...sb.stepCardOk };
          else if (isWrong) cardStyle = { ...sb.stepCard, ...sb.stepCardNo };
          else if (isSelected) cardStyle = { ...sb.stepCard, ...sb.stepCardSel };

          return (
            <TouchableOpacity
              key={step.id}
              style={cardStyle}
              onPress={() => handleTap(step.id)}
              activeOpacity={0.7}
            >
              <View style={[sb.orderBadge, {
                backgroundColor: isCorrect ? C.success :
                  isWrong ? C.danger :
                  isSelected ? C.primary : C.border,
              }]}>
                <Text style={[sb.orderBadgeT, { color: isSelected ? '#fff' : C.muted }]}>
                  {assignedOrder ?? '·'}
                </Text>
              </View>
              <Text style={[sb.stepText, {
                color: isWrong ? C.danger : isCorrect ? C.success : C.text,
              }]}>
                {step.text}
              </Text>
              {isCorrect && <Ionicons name="checkmark-circle" size={18} color={C.success} />}
              {isWrong && (
                <View style={sb.correctHint}>
                  <Text style={sb.correctHintT}>→{correctOrder}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {finished && (
        <View style={[sb.result, { borderColor: correctCount === allSteps.length ? C.success : C.primary }]}>
          <Text style={sb.resultScore}>
            {correctCount}<Text style={{ fontSize: 20, color: C.muted }}>/{allSteps.length}</Text>
          </Text>
          <Text style={sb.resultLabel}>
            {correctCount === allSteps.length ? 'Идеально! Все шаги верны' :
             correctCount >= allSteps.length * 0.8 ? 'Отлично! Почти всё верно' :
             correctCount >= allSteps.length * 0.6 ? 'Хорошо, есть ошибки' :
             'Нужна практика'}
          </Text>
          <TouchableOpacity style={[sb.btn, { backgroundColor: C.success }]} onPress={reset}>
            <Text style={sb.btnT}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ДЕТАЛЬНЫЙ ЭКРАН СТАНЦИИ ────────────────────────────────
function StationDetail({ station, onBack }: { station: Station; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'algorithm' | 'builder' | 'mistakes' | 'phrases'>('algorithm');
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const tabs = [
    { id: 'algorithm', label: 'Алгоритм' },
    { id: 'builder', label: 'Конструктор' },
    { id: 'mistakes', label: 'Ошибки' },
    { id: 'phrases', label: 'Фразы' },
  ] as const;

  return (
    <View style={s.container}>
      <View style={[s.hdr, { backgroundColor: station.color }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={s.backT}>Назад</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>{station.title}</Text>
          <Text style={s.hdrSub}>{station.duration} мин · {station.subtitle}</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, activeTab === t.id && { borderBottomColor: station.color, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[s.tabT, activeTab === t.id && { color: station.color, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {activeTab === 'algorithm' && (
          <View style={{ gap: 10 }}>
            <View style={[s.briefingBox, { borderLeftColor: station.color }]}>
              <Text style={s.briefingLabel}>ЗАДАНИЕ НА СТАНЦИИ</Text>
              <Text style={s.briefingText}>{station.briefing}</Text>
            </View>
            {station.checklistGroups.map(group => (
              <View key={group.title} style={s.groupCard}>
                <TouchableOpacity
                  style={s.groupHeader}
                  onPress={() => setOpenGroup(openGroup === group.title ? null : group.title)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.groupTitle, group.title.startsWith('⚠️') && { color: C.danger }]}>
                    {group.title}
                  </Text>
                  <Ionicons
                    name={openGroup === group.title ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={C.muted}
                  />
                </TouchableOpacity>
                {openGroup === group.title && (
                  <View style={s.groupItems}>
                    {group.items.map((item, idx) => (
                      <View key={item.id} style={s.checkItem}>
                        <View style={[s.checkNum, {
                          backgroundColor: group.title.startsWith('⚠️') ? '#FEF2F2' : station.bgColor,
                        }]}>
                          <Text style={[s.checkNumT, {
                            color: group.title.startsWith('⚠️') ? C.danger : station.color,
                          }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <Text style={s.checkText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'builder' && <StepBuilder station={station} />}

        {activeTab === 'mistakes' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionHint}>Эти ошибки чаще всего снижают балл на аккредитации</Text>
            {station.typicalMistakes.map((mistake, i) => (
              <View key={i} style={s.mistakeCard}>
                <View style={s.mistakeDot} />
                <Text style={s.mistakeText}>{mistake}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'phrases' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionHint}>Говорите эти фразы чётко и уверенно — комиссия их слышит</Text>
            {station.keyPhrases.map((phrase, i) => (
              <View key={i} style={[s.phraseCard, { borderLeftColor: station.color }]}>
                <Text style={s.phraseText}>{phrase}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── ГЛАВНЫЙ СПИСОК ─────────────────────────────────────────
export default function StationsScreen() {
  const [active, setActive] = useState<Station | null>(null);

  if (active) {
    return <StationDetail station={active} onBack={() => setActive(null)} />;
  }

  return (
    <View style={s.container}>
      <View style={s.hdr}>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>Станции аккредитации</Text>
          <Text style={s.hdrSub}>ОСКЭ · Первичная аккредитация · Стоматология</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={C.primary} />
          <Text style={s.infoBannerT}>
            На каждой станции — алгоритм по паспорту МЦА, конструктор последовательности, типичные ошибки и ключевые фразы
          </Text>
        </View>

        {STATIONS.map(station => (
          <TouchableOpacity
            key={station.id}
            style={s.stationCard}
            onPress={() => setActive(station)}
            activeOpacity={0.75}
          >
            <View style={[s.stationIcon, { backgroundColor: station.bgColor }]}>
              {station.iconLib === 'Ionicons'
                ? <Ionicons name={station.icon as any} size={26} color={station.color} />
                : <MaterialCommunityIcons name={station.icon as any} size={26} color={station.color} />
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stationTitle}>{station.title}</Text>
              <Text style={s.stationSub}>{station.subtitle}</Text>
              <View style={s.stationMeta}>
                <Ionicons name="time-outline" size={12} color={C.muted} />
                <Text style={s.stationMetaT}>{station.duration} мин</Text>
                <View style={[s.metaDot, { backgroundColor: station.color }]} />
                <Text style={s.stationMetaT}>
                  {station.checklistGroups.reduce((acc, g) => acc + g.items.length, 0)} шагов
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── СТИЛИ ЭКРАНА ───────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    backgroundColor: C.dark,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hdrTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  hdrSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  backT: { color: '#fff', fontSize: 13, fontWeight: '500' },
  tabRow: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabT: { fontSize: 11, color: C.muted, fontWeight: '500' },
  briefingBox: {
    borderLeftWidth: 3, paddingLeft: 12,
    backgroundColor: C.white, borderRadius: 10, padding: 14,
  },
  briefingLabel: {
    fontSize: 10, fontWeight: '800', color: C.muted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  briefingText: { fontSize: 13, color: C.text2, lineHeight: 20 },
  groupCard: {
    backgroundColor: C.white, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  groupTitle: { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  groupItems: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkNum: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkNumT: { fontSize: 11, fontWeight: '800' },
  checkText: { fontSize: 13, color: C.text2, lineHeight: 19, flex: 1 },
  sectionHint: { fontSize: 12, color: C.muted, lineHeight: 18, marginBottom: 4 },
  mistakeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.white, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  mistakeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginTop: 4, flexShrink: 0 },
  mistakeText: { fontSize: 13, color: C.text2, lineHeight: 19, flex: 1 },
  phraseCard: { borderLeftWidth: 3, paddingLeft: 12, backgroundColor: C.white, borderRadius: 10, padding: 14 },
  phraseText: { fontSize: 13, color: C.text2, lineHeight: 20 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.light, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  infoBannerT: { fontSize: 12, color: C.primary, lineHeight: 18, flex: 1 },
  stationCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  stationIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stationTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  stationSub: { fontSize: 12, color: C.muted, marginBottom: 6 },
  stationMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stationMetaT: { fontSize: 11, color: C.muted },
  metaDot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── СТИЛИ КОНСТРУКТОРА ─────────────────────────────────────
const sb = StyleSheet.create({
  container: { gap: 12 },
  header: { gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: C.text },
  hint: { fontSize: 12, color: C.muted, lineHeight: 17 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: C.muted, width: 36, textAlign: 'right' },
  stepsWrap: { gap: 8 },
  stepCard: {
    backgroundColor: C.white, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 1,
  },
  stepCardSel: { borderColor: C.primary, backgroundColor: '#EFF6FF' },
  stepCardOk: { borderColor: C.success, backgroundColor: '#F0FDF4' },
  stepCardNo: { borderColor: C.danger, backgroundColor: '#FEF2F2' },
  orderBadge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  orderBadgeT: { fontSize: 13, fontWeight: '800' },
  stepText: { fontSize: 13, color: C.text, lineHeight: 18, flex: 1 },
  correctHint: {
    backgroundColor: '#FEE2E2', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0,
  },
  correctHintT: { fontSize: 11, fontWeight: '700', color: C.danger },
  result: {
    backgroundColor: C.white, borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 8, borderWidth: 2,
    shadowColor: '#000', shadowOpacity: 0.06, elevation: 2,
  },
  resultScore: { fontSize: 52, fontWeight: '900', color: C.text },
  resultLabel: { fontSize: 14, color: C.text2, textAlign: 'center' },
  btn: { borderRadius: 12, padding: 14, alignItems: 'center', width: '100%', marginTop: 4 },
  btnT: { color: '#fff', fontSize: 14, fontWeight: '700' },
});