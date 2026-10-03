import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { C, SPECIALTY } from '../../constants/Colors';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { shadowCard } from '../../constants/shadows';
import { COMM_SCENARIOS, CONSULT_SECTIONS, DIAG_CASES, EMERGENCIES, EXAM_CASES, PATIENTS, PROCEDURE_SPECIALTIES, PROCEDURES, STATIONS } from '../../data/clinicalData';
import { useProgress } from '../../lib/progress';
import {
  CASE_FORMS, CONDITION_FORMS, DIRECTION_FORMS, plural, PROTOCOL_FORMS, PSYCHOTYPE_FORMS, SCENARIO_FORMS, SCRIPT_FORMS, STATION_FORMS,
} from '../../lib/plural';

// Счётчики — из данных, чтобы не расходились с контентом
const TOTAL_DIAG = DIAG_CASES.length;
const TOTAL_COMM = COMM_SCENARIOS.length;
const TOTAL_SCRIPTS = CONSULT_SECTIONS.reduce((n, sec) => n + sec.scripts.length, 0);

const MODULES = [
  {
    id: 'patient',
    title: 'ИИ-Пациент',
    desc: `Живой диалог с ${plural(PATIENTS.length, ['психотипом', 'психотипами', 'психотипами'])}`,
    tag: plural(PATIENTS.length, PSYCHOTYPE_FORMS),
    ionIcon: 'chatbubble-ellipses-outline',
    color: SPECIALTY.emergency.solid,
    bg: SPECIALTY.emergency.tint,
    route: '/patient',
  },
  {
    id: 'consult',
    title: 'Консультации',
    desc: 'Скрипты, золотые и запретные слова',
    tag: plural(TOTAL_SCRIPTS, SCRIPT_FORMS),
    ionIcon: 'book-outline',
    color: SPECIALTY.prosthetics.solid,
    bg: SPECIALTY.prosthetics.tint,
    route: '/consult',
  },
  {
    id: 'reception',
    title: 'Приём',
    desc: plural(PROCEDURE_SPECIALTIES.length, DIRECTION_FORMS),
    tag: plural(PROCEDURES.length, PROTOCOL_FORMS),
    mciIcon: 'tooth-outline',
    color: SPECIALTY.therapy.solid,
    bg: SPECIALTY.therapy.tint,
    route: '/reception',
  },
  {
    id: 'diag',
    title: 'Диагностика',
    desc: 'Рентген · ЭОД · кейсы',
    tag: plural(TOTAL_DIAG, CASE_FORMS),
    ionIcon: 'search-outline',
    color: SPECIALTY.prosthetics.solid,
    bg: SPECIALTY.prosthetics.tint,
    route: '/diag',
    isNew: true,
    progressKey: 'diag',
    total: TOTAL_DIAG,
  },
  {
    id: 'comm',
    title: 'Коммуникация',
    desc: `${plural(TOTAL_COMM, PSYCHOTYPE_FORMS)} пациентов`,
    tag: plural(TOTAL_COMM, SCENARIO_FORMS),
    ionIcon: 'people-outline',
    color: SPECIALTY.periodontology.solid,
    bg: SPECIALTY.periodontology.tint,
    route: '/comm',
    isNew: true,
    progressKey: 'comm',
    total: TOTAL_COMM,
  },
  {
    id: 'exam',
    title: 'Экзамен',
    desc: 'Симулятор приёма · 4 этапа',
    tag: plural(EXAM_CASES.length, CASE_FORMS),
    ionIcon: 'school-outline',
    color: SPECIALTY.orthodontics.solid,
    bg: SPECIALTY.orthodontics.tint,
    route: '/exam',
  },
  {
    id: 'stations',
    title: 'Станции ОСКЭ',
    desc: 'Алгоритмы аккредитации',
    tag: plural(STATIONS.length, STATION_FORMS),
    ionIcon: 'medal-outline',
    color: SPECIALTY.emergency.solid,
    bg: SPECIALTY.emergency.tint,
    route: '/stations',
  },
    {
    id: 'emergencies',
    title: 'Неотложка',
    desc: 'Алгоритмы · Препараты · Ошибки',
    tag: plural(EMERGENCIES.length, CONDITION_FORMS),
    ionIcon: 'medkit-outline',
    color: '#B91C1C',
    bg: '#FEF2F2',
    route: '/emergencies',
  },
];

function ModuleCard({ m, progress, onPress }: { m: typeof MODULES[0]; progress: { done: number; total: number } | null; onPress: () => void }) {
  const scale = useState(new Animated.Value(1))[0];
  const pct = progress ? progress.done / progress.total : 0;
  const isDone = progress ? progress.done >= progress.total : false;

  const onPressIn = () => Animated.timing(scale, { toValue: 0.97, duration: 100, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();

  return (
    <Animated.View style={[s.cardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[s.card, shadowCard]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {m.isNew && !isDone && (
          <View style={s.newBadge}>
            <Text style={s.newBadgeT}>NEW</Text>
          </View>
        )}
        {isDone && (
          <View style={[s.newBadge, { backgroundColor: C.success }]}>
            <Text style={s.newBadgeT}>✓</Text>
          </View>
        )}

        <View style={[s.iconPlate, { backgroundColor: m.bg }]}>
          <View style={s.iconPlateBlick} />
          {(m as any).ionIcon
            ? <Ionicons name={(m as any).ionIcon as any} size={22} color={m.color} />
            : <MaterialCommunityIcons name={(m as any).mciIcon as any} size={22} color={m.color} />
          }
        </View>

        <Text style={s.cardTitle}>{m.title}</Text>
        <Text style={s.cardDesc}>{m.desc}</Text>

        {progress ? (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <LinearGradient
                colors={[m.color, m.color + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.progressFill, { width: `${Math.max(pct * 100, 4)}%` as any }]}
              >
                <View style={s.progressInsetLight} />
              </LinearGradient>
              {pct > 0.03 && pct < 1 && (
                <View style={[s.progressDrop, { left: `${pct * 100}%` as any, backgroundColor: m.color }]} />
              )}
            </View>
            <Text style={[s.progressLabel, { color: m.color }]}>
              Прогресс {Math.round(pct * 100)}%
            </Text>
          </View>
        ) : (
          <View style={[s.tagWrap, { backgroundColor: m.bg }]}>
            <Text style={[s.tagT, { color: m.color }]}>{m.tag}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const headerTop = useHeaderTopPadding();
  const router = useRouter();
  const { stats } = useProgress();

  const getProgress = (key?: string) => {
    if (!key) return null;
    if (key === 'diag') return { done: Math.min(stats.diagCases, TOTAL_DIAG), total: TOTAL_DIAG };
    if (key === 'comm') return { done: Math.min(stats.commScenarios, TOTAL_COMM), total: TOTAL_COMM };
    return null;
  };

  return (
    <View style={s.container}>
      <LinearGradient
        colors={[C.navyDeep, C.navyBase]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[s.header, { paddingTop: headerTop }]}
      >
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.headerRow}>
          <View>
            <Text style={s.logo}><Text style={s.logoAccent}>Den</Text>vise</Text>
            <Text style={s.subtitle}>Тренажёр стоматолога</Text>
          </View>
          <View style={s.headerRight}>
            {stats.streak > 0 && (
              <View style={s.streakBadge}>
                <Text style={s.streakBadgeT}>🔥 {stats.streak}</Text>
              </View>
            )}
            <TouchableOpacity style={s.xpBadge} onPress={() => router.push('/profile')}>
              <Text style={s.xpBadgeT}>{stats.xp} XP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {MODULES.map(m => (
            <ModuleCard
              key={m.id}
              m={m}
              progress={getProgress((m as any).progressKey)}
              onPress={() => router.push(m.route as any)}
            />
          ))}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingBottom: 18,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.30)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  logoAccent: { color: C.primary500 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  streakBadgeT: { fontSize: 13, fontWeight: '700', color: '#fff' },
  xpBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  xpBadgeT: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scroll: { padding: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrap: { width: '47.5%' },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  newBadge: {
    position: 'absolute',
    top: 12, right: 12,
    backgroundColor: C.danger,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  newBadgeT: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  iconPlate: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  iconPlateBlick: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.n900, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, color: C.n500, lineHeight: 17 },
  tagWrap: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagT: { fontSize: 11, fontWeight: '700' },
  progressWrap: { gap: 5 },
  progressBg: {
    height: 8, backgroundColor: C.n200, borderRadius: 999,
    overflow: 'visible', position: 'relative', justifyContent: 'center',
  },
  progressFill: {
    height: 8, borderRadius: 999, overflow: 'hidden', position: 'relative',
  },
  progressInsetLight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressDrop: {
    position: 'absolute',
    width: 10, height: 10, borderRadius: 5,
    top: -1, marginLeft: -5,
    borderWidth: 2, borderColor: '#fff',
  },
  progressLabel: { fontSize: 10, fontWeight: '700' },
});