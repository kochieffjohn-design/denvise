import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/Colors';
import { getStats, type Stats } from '../../data/xpStorage';

const TOTAL_DIAG = 17;
const TOTAL_COMM = 8;

const MODULES = [
  {
    id: 'patient',
    title: 'ИИ-Пациент',
    desc: 'Живой диалог с 6 психотипами через ИИ',
    tag: '6 психотипов',
    ionIcon: 'chatbubble-ellipses-outline',
    color: '#534AB7',
    bg: '#EEEDFE',
    route: '/patient',
  },
  {
    id: 'consult',
    title: 'Консультации',
    desc: 'Скрипты, золотые и запретные слова',
    tag: '19 скриптов',
    ionIcon: 'book-outline',
    color: '#0F6E56',
    bg: '#E1F5EE',
    route: '/consult',
  },
  {
    id: 'reception',
    title: 'Приём',
    desc: 'Протоколы по всем специальностям',
    tag: '15 протоколов',
    mciIcon: 'tooth-outline',
    color: '#185FA5',
    bg: '#E6F1FB',
    route: '/reception',
  },
  {
    id: 'diag',
    title: 'Диагностика',
    desc: 'Кейсы с рентгеном, ЭОД, симптомами',
    tag: `${TOTAL_DIAG} кейсов`,
    ionIcon: 'search-outline',
    color: '#2E7D32',
    bg: '#E8F5E9',
    route: '/diag',
    isNew: true,
    progressKey: 'diag',
    total: TOTAL_DIAG,
  },
  {
    id: 'comm',
    title: 'Коммуникация',
    desc: 'Тренажёр живого диалога с пациентом',
    tag: `${TOTAL_COMM} сценариев`,
    ionIcon: 'people-outline',
    color: '#993556',
    bg: '#FBEAF0',
    route: '/comm',
    isNew: true,
    progressKey: 'comm',
    total: TOTAL_COMM,
  },
  {
    id: 'exam',
    title: 'Экзамен',
    desc: 'Полный симулятор приёма — 4 этапа',
    tag: '12 кейсов',
    ionIcon: 'school-outline',
    color: '#854F0B',
    bg: '#FAEEDA',
    route: '/exam',
  },
  {
    id: 'stations',
    title: 'Станции ОСКЭ',
    desc: 'Алгоритмы аккредитационных станций',
    tag: '6 станций',
    ionIcon: 'medal-outline',
    color: '#7B1FA2',
    bg: '#F3E5F5',
    route: '/stations',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    xp: 0, diagCases: 0, commScenarios: 0, exams: 0,
    lastUpdated: 0, streak: 0, lastActivityDate: '',
  });

  useEffect(() => {
    AsyncStorage.getItem('denvise_onboarded').then(val => {
      if (!val) router.push('/onboarding');
    });
  }, []);

  useFocusEffect(useCallback(() => {
    getStats().then(setStats);
  }, []));

  const getProgress = (key?: string) => {
    if (!key) return null;
    if (key === 'diag') return { done: Math.min(stats.diagCases, TOTAL_DIAG), total: TOTAL_DIAG };
    if (key === 'comm') return { done: Math.min(stats.commScenarios, TOTAL_COMM), total: TOTAL_COMM };
    return null;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
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

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.grid}>
          {MODULES.map(m => {
            const progress = getProgress((m as any).progressKey);
            const pct = progress ? progress.done / progress.total : 0;
            const isDone = progress ? progress.done >= progress.total : false;

            return (
              <TouchableOpacity
                key={m.id}
                style={s.card}
                onPress={() => router.push(m.route as any)}
                activeOpacity={0.75}
              >
                {(m as any).isNew && !isDone && (
                  <View style={s.newBadge}>
                    <Text style={s.newBadgeT}>NEW</Text>
                  </View>
                )}
                {isDone && (
                  <View style={[s.newBadge, { backgroundColor: C.success }]}>
                    <Text style={s.newBadgeT}>✓</Text>
                  </View>
                )}

                <View style={[s.iconWrap, { backgroundColor: m.bg }]}>
                  {(m as any).ionIcon
                    ? <Ionicons name={(m as any).ionIcon as any} size={26} color={m.color} />
                    : <MaterialCommunityIcons name={(m as any).mciIcon as any} size={26} color={m.color} />
                  }
                </View>

                <Text style={s.cardTitle}>{m.title}</Text>
                <Text style={s.cardDesc}>{m.desc}</Text>

                {progress ? (
                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, {
                        width: `${pct * 100}%` as any,
                        backgroundColor: m.color,
                      }]} />
                    </View>
                    <Text style={[s.progressLabel, { color: m.color }]}>
                      {progress.done}/{progress.total}
                    </Text>
                  </View>
                ) : (
                  <View style={[s.tagWrap, { backgroundColor: m.bg }]}>
                    <Text style={[s.tagT, { color: m.color }]}>{m.tag}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.dark,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { fontSize: 28, fontWeight: '800', color: C.white, letterSpacing: -0.5 },
  logoAccent: { color: C.accent },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  streakBadgeT: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  xpBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  xpBadgeT: { color: C.white, fontSize: 13, fontWeight: '700' },
  scroll: { padding: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    width: '47.5%',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
  },
  newBadgeT: { color: C.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  iconWrap: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, color: C.muted, lineHeight: 17 },
  tagWrap: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagT: { fontSize: 11, fontWeight: '700' },
  progressWrap: { gap: 4 },
  progressBg: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontSize: 10, fontWeight: '700' },
});