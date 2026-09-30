import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
        <Text style={sb.title}>Последовательность</Text>
        <Text style={sb.hint}>
          Нажимай шаги в правильном порядке — первый нажатый = шаг 1, второй = шаг 2 и т.д.
        </Text>
      </View>

      <View style={sb.progressRow}>
        <View style={sb.progressBg}>
          <LinearGradient
            colors={
              finished
                ? (correctCount === allSteps.length ? ['#16A06B', '#3FC793'] : ['#D9534A', '#E8807A'])
                : [C.primary500, C.primary600]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[sb.progressFill, {
              width: `${Math.max((finished ? correctCount / allSteps.length : selected.length / allSteps.length) * 100, 3)}%` as any,
            }]}
          >
            <View style={sb.progressInsetLight} />
          </LinearGradient>
        </View>
        <Text style={sb.progressLabel}>
          {finished ? `${correctCount}/${allSteps.length}` : `${selected.length}/${allSteps.length}`}
        </Text>
      </View>

      <View style={sb.stepsWrap}>
        {shuffled.map(step => {
          const assignedOrder = getAssignedOrder(step.id);
          const correctOrder = getCorrectOrder(step.id);
          const isSelected = assignedOrder !== null;
          const isCorrect = finished && assignedOrder === correctOrder;
          const isWrong = finished && isSelected && assignedOrder !== correctOrder;
          const isPending = !isSelected;

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
              <View style={[
                sb.orderBadge,
                isCorrect && sb.orderBadgeOk,
                isWrong && sb.orderBadgeNo,
                isSelected && !finished && sb.orderBadgeSel,
                isPending && sb.orderBadgePending,
              ]}>
                {isPending ? (
                  <View style={sb.pendingDash} />
                ) : (
                  <Text style={[sb.orderBadgeT, { color: isSelected ? '#fff' : C.n400 }]}>
                    {assignedOrder}
                  </Text>
                )}
              </View>
              <Text style={[sb.stepText, {
                color: isCorrect ? '#0E6E4C' : C.n900,
              }]}>
                {step.text}
              </Text>
              {isCorrect && (
                <View style={sb.checkCircle}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
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
        <View style={[sb.result, { borderColor: correctCount === allSteps.length ? '#16A06B' : C.primary500 }]}>
          <Text style={sb.resultScore}>
            {correctCount}<Text style={{ fontSize: 20, color: C.n400 }}>/{allSteps.length}</Text>
          </Text>
          <Text style={sb.resultLabel}>
            {correctCount === allSteps.length ? 'Идеально! Все шаги верны' :
             correctCount >= allSteps.length * 0.8 ? 'Отлично! Почти всё верно' :
             correctCount >= allSteps.length * 0.6 ? 'Хорошо, есть ошибки' :
             'Нужна практика'}
          </Text>
          <TouchableOpacity style={sb.btn} onPress={reset}>
            <LinearGradient
              colors={['#16A06B', '#3FC793']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={sb.btnGradient}
            >
              <Text style={sb.btnT}>Попробовать снова</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ДЕТАЛЬНЫЙ ЭКРАН СТАНЦИИ ────────────────────────────────
function StationDetail({ station, onBack }: { station: Station; onBack: () => void }) {
  const headerTop = useHeaderTopPadding();
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
      <LinearGradient
        colors={[C.navyDeep, C.navyBase, station.color]}
        locations={[0, 0.55, 1.3]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hdr, { paddingTop: headerTop }]}
      >
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={s.backT}>Назад</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>{station.title}</Text>
          <Text style={s.hdrSub}>{station.duration} мин · {station.subtitle}</Text>
        </View>
      </LinearGradient>

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
                    color={C.n400}
                  />
                </TouchableOpacity>
                {openGroup === group.title && (
                  <View style={s.groupItems}>
                    {group.items.map((item, idx) => (
                      <View key={item.id} style={s.checkItem}>
                        <View style={[s.checkNum, {
                          backgroundColor: group.title.startsWith('⚠️') ? '#FBEEEC' : station.bgColor,
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
  const headerTop = useHeaderTopPadding();
  const [active, setActive] = useState<Station | null>(null);

  const t = useScreenTransition(active ? `station-${active.id}` : 'list', active ? 1 : 0);

  if (active) {
    return t(<StationDetail station={active} onBack={() => setActive(null)} />);
  }

  return t(
    <View style={s.container}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={[s.hdr, { paddingTop: headerTop }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>Станции аккредитации</Text>
          <Text style={s.hdrSub}>ОСКЭ · Первичная аккредитация · Стоматология</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View style={s.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={C.primary500} />
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
                <Ionicons name="time-outline" size={12} color={C.n400} />
                <Text style={s.stationMetaT}>{station.duration} мин</Text>
                <View style={[s.metaDot, { backgroundColor: station.color }]} />
                <Text style={s.stationMetaT}>
                  {station.checklistGroups.reduce((acc, g) => acc + g.items.length, 0)} шагов
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.n400} />
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
    flexDirection: 'row', backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tab: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabT: { fontSize: 11, color: C.n500, fontWeight: '500' },
  briefingBox: {
    borderLeftWidth: 3, paddingLeft: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
  },
  briefingLabel: {
    fontSize: 10, fontWeight: '800', color: C.n400,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  briefingText: { fontSize: 13, color: C.n700, lineHeight: 20 },
  groupCard: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: C.n900, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
  },
  groupTitle: { fontSize: 14, fontWeight: '700', color: C.n900, flex: 1 },
  groupItems: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkNum: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkNumT: { fontSize: 11, fontWeight: '800' },
  checkText: { fontSize: 13, color: C.n700, lineHeight: 19, flex: 1 },
  sectionHint: { fontSize: 12, color: C.n500, lineHeight: 18, marginBottom: 4 },
  mistakeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  mistakeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginTop: 4, flexShrink: 0 },
  mistakeText: { fontSize: 13, color: C.n700, lineHeight: 19, flex: 1 },
  phraseCard: { borderLeftWidth: 3, paddingLeft: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  phraseText: { fontSize: 13, color: C.n700, lineHeight: 20 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.primary50, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  infoBannerT: { fontSize: 12, color: C.primary600, lineHeight: 18, flex: 1 },
  stationCard: {
    backgroundColor: C.card, borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  stationIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stationTitle: { fontSize: 15, fontWeight: '700', color: C.n900, marginBottom: 3 },
  stationSub: { fontSize: 12, color: C.n500, marginBottom: 6 },
  stationMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stationMetaT: { fontSize: 11, color: C.n500 },
  metaDot: { width: 4, height: 4, borderRadius: 2 },
});

// ─── СТИЛИ КОНСТРУКТОРА ─────────────────────────────────────
const sb = StyleSheet.create({
  container: { gap: 12 },
  header: { gap: 4 },
  title: { fontSize: 15, fontWeight: '700', color: C.n900 },
  hint: { fontSize: 12, color: C.n500, lineHeight: 17 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 8, backgroundColor: C.n200, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, overflow: 'hidden', position: 'relative' },
  progressInsetLight: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.3)' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: C.n500, width: 36, textAlign: 'right' },
  stepsWrap: { gap: 8 },
  stepCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
  },
 stepCardSel: { borderColor: C.primary500, backgroundColor: C.primary50, borderWidth: 1.5 },
  stepCardOk: { borderColor: '#16A06B', backgroundColor: '#F3FBF7', borderWidth: 1 },
  stepCardNo: { borderColor: C.border, backgroundColor: C.card, borderWidth: 1 },
  orderBadge: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    backgroundColor: C.n100, borderWidth: 1, borderColor: C.n200,
  },
  orderBadgePending: { borderStyle: 'dashed', backgroundColor: C.sunk },
  orderBadgeSel: { backgroundColor: C.primary500, borderColor: C.primary500 },
  orderBadgeOk: { backgroundColor: '#16A06B', borderColor: '#16A06B' },
  orderBadgeNo: { backgroundColor: '#D9534A', borderColor: '#D9534A' },
  orderBadgeT: { fontSize: 13, fontWeight: '800' },
  pendingDash: { width: 8, height: 2, borderRadius: 1, backgroundColor: C.n300 },
  stepText: { fontSize: 13, lineHeight: 18, flex: 1 },
  checkCircle: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A06B',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  correctHint: {
    backgroundColor: '#FBEEEC', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0,
  },
  correctHintT: { fontSize: 11, fontWeight: '700', color: '#D9534A' },
  result: {
    backgroundColor: C.card, borderRadius: 18, padding: 24,
    alignItems: 'center', gap: 8, borderWidth: 2,
    shadowColor: C.n900, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  resultScore: { fontSize: 52, fontWeight: '900', color: C.n900 },
  resultLabel: { fontSize: 14, color: C.n700, textAlign: 'center' },
  btn: { borderRadius: 14, width: '100%', marginTop: 4, overflow: 'hidden' },
  btnGradient: { paddingVertical: 14, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 14, fontWeight: '700' },
});