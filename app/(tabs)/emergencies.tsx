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
import { EMERGENCIES, type Emergency } from '../../data/emergencyData';

// ─── КОНСТРУКТОР ────────────────────────────────────────────
function StepBuilder({ emergency }: { emergency: Emergency }) {
  const allSteps = emergency.checklistGroups
    .filter(g => !g.title.startsWith('⚠️') && !g.title.startsWith('Распознавание') && !g.title.startsWith('Дифференциация') && !g.title.startsWith('Профилактика'))
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
    const next = [...selected, stepId];
    setSelected(next);
    if (next.length === allSteps.length) setFinished(true);
  };

  const getCorrectOrder = (id: string) => allSteps.findIndex(s => s.id === id) + 1;
  const getAssigned = (id: string) => { const i = selected.indexOf(id); return i === -1 ? null : i + 1; };
  const correctCount = finished ? selected.filter((id, i) => getCorrectOrder(id) === i + 1).length : 0;
  const reset = () => { setSelected([]); setFinished(false); };

  if (allSteps.length === 0) {
    return (
      <View style={sb.empty}>
        <Text style={sb.emptyT}>Для этого состояния конструктор недоступен — алгоритм зависит от состояния пациента в реальном времени</Text>
      </View>
    );
  }

  return (
    <View style={sb.container}>
      <Text style={sb.title}>Последовательность действий</Text>
      <Text style={sb.hint}>Нажимай шаги в правильном порядке — первый нажатый = шаг 1</Text>

      <View style={sb.progressRow}>
        <View style={sb.progressBg}>
          <LinearGradient
            colors={finished
              ? (correctCount === allSteps.length ? ['#16A06B', '#3FC793'] : ['#D9534A', '#E8807A'])
              : [C.primary500, C.primary600]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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
          const assigned = getAssigned(step.id);
          const correct = getCorrectOrder(step.id);
          const isSelected = assigned !== null;
          const isCorrect = finished && assigned === correct;
          const isWrong = finished && isSelected && assigned !== correct;
          const isPending = !isSelected;

          let cardStyle = sb.stepCard;
          if (isCorrect) cardStyle = { ...sb.stepCard, ...sb.stepCardOk };
          else if (isWrong) cardStyle = { ...sb.stepCard, ...sb.stepCardNo };
          else if (isSelected) cardStyle = { ...sb.stepCard, ...sb.stepCardSel };

          return (
            <TouchableOpacity key={step.id} style={cardStyle} onPress={() => handleTap(step.id)} activeOpacity={0.7}>
              <View style={[sb.badge,
                isCorrect && sb.badgeOk,
                isWrong && sb.badgeNo,
                isSelected && !finished && sb.badgeSel,
                isPending && sb.badgePending,
              ]}>
                {isPending
                  ? <View style={sb.dash} />
                  : <Text style={[sb.badgeT, { color: isSelected ? '#fff' : C.n400 }]}>{assigned}</Text>
                }
              </View>
              <Text style={[sb.stepText, { color: isCorrect ? '#0E6E4C' : C.n900 }]}>{step.text}</Text>
              {isCorrect && <View style={sb.checkCircle}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
              {isWrong && <View style={sb.wrongHint}><Text style={sb.wrongHintT}>→{correct}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </View>

      {finished && (
        <View style={[sb.result, { borderColor: correctCount === allSteps.length ? '#16A06B' : C.primary500 }]}>
          <Text style={sb.resultScore}>{correctCount}<Text style={{ fontSize: 20, color: C.n400 }}>/{allSteps.length}</Text></Text>
          <Text style={sb.resultLabel}>
            {correctCount === allSteps.length ? 'Идеально! Все верно' :
             correctCount >= allSteps.length * 0.8 ? 'Отлично! Почти всё верно' :
             correctCount >= allSteps.length * 0.6 ? 'Хорошо, есть ошибки' : 'Нужна практика'}
          </Text>
          <TouchableOpacity style={sb.btn} onPress={reset}>
            <LinearGradient colors={['#16A06B', '#3FC793']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={sb.btnGrad}>
              <Text style={sb.btnT}>Попробовать снова</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── ДЕТАЛЬНЫЙ ЭКРАН ────────────────────────────────────────
function EmergencyDetail({ item, onBack }: { item: Emergency; onBack: () => void }) {
  const headerTop = useHeaderTopPadding();
  const [activeTab, setActiveTab] = useState<'algorithm' | 'builder' | 'mistakes' | 'meds'>('algorithm');
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const tabs = [
    { id: 'algorithm', label: 'Алгоритм' },
    { id: 'builder', label: 'Конструктор' },
    { id: 'mistakes', label: 'Ошибки' },
    { id: 'meds', label: 'Препараты' },
  ] as const;

  return (
    <View style={s.container}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={[s.hdr, { paddingTop: headerTop }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={s.backT}>Назад</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>{item.title}</Text>
          <Text style={s.hdrSub}>{item.subtitle}</Text>
        </View>
        <View style={[s.hdrIcon, { backgroundColor: item.bgColor }]}>
          <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
        </View>
      </LinearGradient>

      <View style={s.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, activeTab === t.id && { borderBottomColor: item.color, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text style={[s.tabT, activeTab === t.id && { color: item.color, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {activeTab === 'algorithm' && (
          <View style={{ gap: 10 }}>
            <View style={[s.briefingBox, { borderLeftColor: item.color }]}>
              <Text style={s.briefingLabel}>СИТУАЦИЯ</Text>
              <Text style={s.briefingText}>{item.briefing}</Text>
            </View>
            {item.checklistGroups.map(group => {
              const isDanger = group.title.startsWith('⚠️');
              return (
                <View key={group.title} style={s.groupCard}>
                  <TouchableOpacity
                    style={s.groupHeader}
                    onPress={() => setOpenGroup(openGroup === group.title ? null : group.title)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.groupTitle, isDanger && { color: C.danger }]}>{group.title}</Text>
                    <Ionicons name={openGroup === group.title ? 'chevron-up' : 'chevron-down'} size={16} color={C.n400} />
                  </TouchableOpacity>
                  {openGroup === group.title && (
                    <View style={s.groupItems}>
                      {group.items.map((step, idx) => (
                        <View key={step.id} style={s.checkItem}>
                          <View style={[s.checkNum, { backgroundColor: isDanger ? '#FEF2F2' : item.bgColor }]}>
                            <Text style={[s.checkNumT, { color: isDanger ? C.danger : item.color }]}>{idx + 1}</Text>
                          </View>
                          <Text style={s.checkText}>{step.text}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'builder' && <StepBuilder emergency={item} />}

        {activeTab === 'mistakes' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionHint}>Эти ошибки чаще всего ухудшают исход при реальном неотложном состоянии</Text>
            {item.typicalMistakes.map((m, i) => (
              <View key={i} style={s.mistakeCard}>
                <Ionicons name="warning-outline" size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                <Text style={s.mistakeText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'meds' && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionHint}>Состав укладки и медикаментозная тактика</Text>
            {item.emergencyMeds.map((m, i) => (
              <View key={i} style={[s.medCard, { borderLeftColor: item.color }]}>
                <Text style={s.medText}>{m}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

// ─── ГЛАВНЫЙ СПИСОК ─────────────────────────────────────────
export default function EmergenciesScreen() {
  const headerTop = useHeaderTopPadding();
  const [active, setActive] = useState<Emergency | null>(null);

  const t = useScreenTransition(active ? `item-${active.id}` : 'list', active ? 1 : 0);

  if (active) return t(<EmergencyDetail item={active} onBack={() => setActive(null)} />);

  return t(
    <View style={s.container}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={[s.hdr, { paddingTop: headerTop }]}>
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>Неотложные состояния</Text>
          <Text style={s.hdrSub}>Алгоритмы действий врача-стоматолога</Text>
        </View>
        <View style={[s.hdrIcon, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#fff" />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View style={s.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color={C.n500} />
          <Text style={s.disclaimerT}>Раздел носит обучающий характер. При реальном неотложном состоянии действуйте согласно протоколам учреждения и вызывайте экстренную помощь.</Text>
        </View>

        {EMERGENCIES.map(item => (
          <TouchableOpacity key={item.id} style={s.card} onPress={() => setActive(item)} activeOpacity={0.75}>
            <View style={[s.cardIcon, { backgroundColor: item.bgColor }]}>
              <View style={s.cardIconBlick} />
              <MaterialCommunityIcons name={item.icon as any} size={26} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{item.title}</Text>
              <Text style={s.cardSub}>{item.subtitle}</Text>
              <View style={s.cardMeta}>
                <View style={[s.metaDot, { backgroundColor: item.color }]} />
                <Text style={s.cardMetaT}>{item.checklistGroups.reduce((a, g) => a + g.items.length, 0)} шагов</Text>
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

// ─── СТИЛИ ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    paddingBottom: 14, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
  },
  headerGlow: { position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 999, backgroundColor: 'rgba(220,38,38,0.25)' },
  hdrTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  hdrSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  hdrIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: '#fff', fontSize: 13, fontWeight: '500' },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: C.sunk, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  disclaimerT: { fontSize: 11, color: C.n500, lineHeight: 16, flex: 1 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  cardIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden' },
  cardIconBlick: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.35)', borderTopLeftRadius: 15, borderTopRightRadius: 15 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.n900, letterSpacing: -0.2, marginBottom: 3 },
  cardSub: { fontSize: 11, color: C.n500, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDot: { width: 5, height: 5, borderRadius: 3 },
  cardMetaT: { fontSize: 11, color: C.n500 },
  tabRow: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabT: { fontSize: 11, color: C.n500, fontWeight: '500' },
  briefingBox: { borderLeftWidth: 3, paddingLeft: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  briefingLabel: { fontSize: 10, fontWeight: '800', color: C.n400, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  briefingText: { fontSize: 13, color: C.n700, lineHeight: 20 },
  groupCard: { backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', shadowColor: C.n900, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: C.n900, flex: 1 },
  groupItems: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkNum: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkNumT: { fontSize: 11, fontWeight: '800' },
  checkText: { fontSize: 13, color: C.n700, lineHeight: 19, flex: 1 },
  sectionHint: { fontSize: 12, color: C.n500, lineHeight: 18, marginBottom: 4 },
  mistakeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  mistakeText: { fontSize: 13, color: C.n700, lineHeight: 19, flex: 1 },
  medCard: { borderLeftWidth: 3, paddingLeft: 12, backgroundColor: C.card, borderRadius: 14, padding: 14 },
  medText: { fontSize: 13, color: C.n700, lineHeight: 20 },
});

const sb = StyleSheet.create({
  container: { gap: 12 },
  empty: { backgroundColor: C.card, borderRadius: 14, padding: 20, alignItems: 'center' },
  emptyT: { fontSize: 13, color: C.n500, textAlign: 'center', lineHeight: 20 },
  title: { fontSize: 15, fontWeight: '700', color: C.n900 },
  hint: { fontSize: 12, color: C.n500, lineHeight: 17 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBg: { flex: 1, height: 8, backgroundColor: C.n200, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressInsetLight: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.3)' },
  progressLabel: { fontSize: 12, fontWeight: '700', color: C.n500, width: 36, textAlign: 'right' },
  stepsWrap: { gap: 8 },
  stepCard: { backgroundColor: C.card, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.border },
  stepCardSel: { borderColor: C.primary500, backgroundColor: C.primary50 },
  stepCardOk: { borderColor: '#16A06B', backgroundColor: '#F0FDF9' },
  stepCardNo: { borderColor: C.border, backgroundColor: C.card },
  badge: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.n100, borderWidth: 1, borderColor: C.n200 },
  badgePending: { borderStyle: 'dashed', backgroundColor: C.sunk },
  badgeSel: { backgroundColor: C.primary500, borderColor: C.primary500 },
  badgeOk: { backgroundColor: '#16A06B', borderColor: '#16A06B' },
  badgeNo: { backgroundColor: C.danger, borderColor: C.danger },
  badgeT: { fontSize: 13, fontWeight: '800' },
  dash: { width: 8, height: 2, borderRadius: 1, backgroundColor: C.n300 },
  stepText: { fontSize: 13, lineHeight: 18, flex: 1 },
  checkCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A06B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  wrongHint: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 },
  wrongHintT: { fontSize: 11, fontWeight: '700', color: C.danger },
  result: { backgroundColor: C.card, borderRadius: 18, padding: 24, alignItems: 'center', gap: 8, borderWidth: 2, shadowColor: C.n900, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  resultScore: { fontSize: 52, fontWeight: '900', color: C.n900 },
  resultLabel: { fontSize: 14, color: C.n700, textAlign: 'center' },
  btn: { borderRadius: 14, width: '100%', marginTop: 4, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 14, fontWeight: '700' },
});