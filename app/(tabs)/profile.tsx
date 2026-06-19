import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../constants/theme';
import { getStats, resetStats, type Stats } from '../../data/xpStorage';

const LEVELS = [
  { level: 1, title: 'Интерн',           minXp: 0,    maxXp: 199,  roman: 'I',    color: '#94a3b8' },
  { level: 2, title: 'Ординатор',        minXp: 200,  maxXp: 499,  roman: 'II',   color: '#60a5fa' },
  { level: 3, title: 'Врач',             minXp: 500,  maxXp: 999,  roman: 'III',  color: '#34d399' },
  { level: 4, title: 'Специалист',       minXp: 1000, maxXp: 1499, roman: 'IV',   color: '#a78bfa' },
  { level: 5, title: 'Эксперт',          minXp: 1500, maxXp: 3499, roman: 'V',    color: '#f59e0b' },
  { level: 6, title: 'Профессор',        minXp: 3500, maxXp: 4499, roman: 'VI',   color: '#f97316' },
  { level: 7, title: 'Владелец клиники', minXp: 4500, maxXp: 99999,roman: 'VII',  color: '#1565c0' },
];

function getCurrentLevel(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(xp: number) {
  const current = getCurrentLevel(xp);
  return LEVELS.find(l => l.level === current.level + 1) || null;
}

export default function ProfileScreen() {
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<'profile' | 'levels'>('profile');
  const [stats, setStats] = useState<Stats>({
    xp: 0, diagCases: 0, commScenarios: 0, exams: 0,
    lastUpdated: 0, streak: 0, lastActivityDate: '',
  });

  useFocusEffect(useCallback(() => {
    getStats().then(setStats);
  }, []));

  const C = theme;
  const xp = stats.xp;
  const currentLevel = getCurrentLevel(xp);
  const nextLevel = getNextLevel(xp);
  const progressInLevel = xp - currentLevel.minXp;
  const levelRange = (nextLevel ? nextLevel.minXp : currentLevel.maxXp + 1) - currentLevel.minXp;
  const progressPct = nextLevel ? Math.min(progressInLevel / levelRange, 1) : 1;

  const streakText =
    stats.streak >= 30 ? 'Легендарная серия!' :
    stats.streak >= 14 ? 'Невероятно!' :
    stats.streak >= 7  ? 'Отличная неделя!' :
    stats.streak >= 3  ? 'Так держать!' : 'Хорошее начало!';

  const streakLabel =
    stats.streak === 1 ? 'день подряд' :
    stats.streak < 5   ? 'дня подряд' : 'дней подряд';

  const STAT_ITEMS = [
    { label: 'Диагностика',  value: `${stats.diagCases}`,     sub: 'кейсов',    icon: 'Dx', color: '#185FA5', bg: '#E6F1FB' },
    { label: 'Коммуникация', value: `${stats.commScenarios}`, sub: 'сценариев', icon: 'Cm', color: '#993556', bg: '#FBEAF0' },
    { label: 'Экзамены',     value: `${stats.exams}`,         sub: 'пройдено',  icon: 'Ex', color: '#854F0B', bg: '#FAEEDA' },
    { label: 'XP набрано',   value: `${stats.xp}`,            sub: 'очков',     icon: 'XP', color: C.primary, bg: C.light  },
  ];

  const s = makeStyles(C);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Профиль</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'profile' && s.tabActive]} onPress={() => setTab('profile')}>
          <Text style={[s.tabT, tab === 'profile' && s.tabTActive]}>Мой профиль</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'levels' && s.tabActive]} onPress={() => setTab('levels')}>
          <Text style={[s.tabT, tab === 'levels' && s.tabTActive]}>Уровни</Text>
        </TouchableOpacity>
      </View>

      {tab === 'profile' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Streak */}
          {stats.streak > 0 && (
            <View style={s.streakCard}>
              <View style={s.streakLeft}>
                <Text style={s.streakFire}>🔥</Text>
                <View>
                  <Text style={s.streakNum}>{stats.streak}</Text>
                  <Text style={s.streakLabel}>{streakLabel}</Text>
                </View>
              </View>
              <Text style={s.streakDesc}>{streakText}</Text>
            </View>
          )}

          {/* Уровень */}
          <View style={[s.levelCard, { borderColor: currentLevel.color }]}>
            <View style={[s.romanCircle, { backgroundColor: currentLevel.color }]}>
              <Text style={s.romanText}>{currentLevel.roman}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.levelTitle}>{currentLevel.title}</Text>
              <Text style={s.levelXp}>
                {xp} XP{nextLevel ? ` · до ${nextLevel.title}: ${nextLevel.minXp - xp} XP` : ' · Максимальный уровень'}
              </Text>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${progressPct * 100}%` as any, backgroundColor: currentLevel.color }]} />
              </View>
            </View>
          </View>

          {/* Статистика */}
          <Text style={s.sectionTitle}>Статистика</Text>
          <View style={s.statsGrid}>
            {STAT_ITEMS.map((st, i) => (
              <View key={i} style={s.statCard}>
                <View style={[s.statIconWrap, { backgroundColor: st.bg }]}>
                  <Text style={[s.statIconText, { color: st.color }]}>{st.icon}</Text>
                </View>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statSub}>{st.sub}</Text>
              </View>
            ))}
          </View>


          {/* О приложении */}
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>О приложении</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Версия</Text>
              <Text style={s.infoValue}>Denvise 4.0</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>База знаний</Text>
              <Text style={s.infoValue}>Нац. руководства МЗ РФ</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Источники</Text>
              <Text style={s.infoValue}>Боровский, Кулаков, Лебеденко</Text>
            </View>
          </View>

          {/* Сброс */}
          <TouchableOpacity style={s.resetBtn} onPress={() => {
            resetStats().then(() => setStats({
              xp: 0, diagCases: 0, commScenarios: 0, exams: 0,
              lastUpdated: 0, streak: 0, lastActivityDate: '',
            }));
          }}>
            <Text style={s.resetBtnT}>Сбросить прогресс</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {tab === 'levels' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.levelsDesc}>Проходите кейсы, сценарии и экзамены — зарабатывайте XP и повышайте уровень</Text>

          <View style={s.xpGuide}>
            <Text style={s.xpGuideTitle}>Как зарабатывать XP</Text>
            {[
              { action: 'Диагностика · лёгкий кейс',  xp: '+30 XP' },
              { action: 'Диагностика · средний кейс', xp: '+50 XP' },
              { action: 'Диагностика · сложный кейс', xp: '+80 XP' },
              { action: 'Коммуникация · сценарий',    xp: '+40 XP' },
              { action: 'Экзамен · результат >55%',   xp: '+60 XP' },
              { action: 'Экзамен · результат >70%',   xp: '+90 XP' },
              { action: 'Экзамен · результат >85%',   xp: '+120 XP' },
            ].map((item, i) => (
              <View key={i} style={s.xpRow}>
                <Text style={s.xpAction}>{item.action}</Text>
                <Text style={[s.xpBadge, { color: C.primary }]}>{item.xp}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Все уровни</Text>
          {LEVELS.map(lvl => {
            const isCurrent = lvl.level === currentLevel.level;
            const isUnlocked = xp >= lvl.minXp;
            return (
              <View key={lvl.level} style={[s.levelRow, isCurrent && { borderColor: lvl.color, borderWidth: 2 }]}>
                <View style={[s.romanCircleSm, { backgroundColor: isUnlocked ? lvl.color : C.border }]}>
                  <Text style={[s.romanTextSm, { color: isUnlocked ? '#fff' : C.muted }]}>{lvl.roman}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.levelRowTitle, !isUnlocked && { color: C.muted }]}>{lvl.title}</Text>
                    {isCurrent && (
                      <View style={[s.currentBadge, { backgroundColor: lvl.color }]}>
                        <Text style={s.currentBadgeText}>Текущий</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.levelRowXp}>
                    {lvl.maxXp === 99999 ? `от ${lvl.minXp} XP` : `${lvl.minXp} – ${lvl.maxXp} XP`}
                  </Text>
                </View>
                {!isUnlocked && (
                  <View style={[s.lockIcon, { backgroundColor: C.border }]}>
                    <Text style={[s.lockText, { color: C.muted }]}>—</Text>
                  </View>
                )}
                {isUnlocked && !isCurrent && (
                  <View style={[s.doneIcon, { backgroundColor: lvl.color + '22' }]}>
                    <Text style={[s.doneText, { color: lvl.color }]}>✓</Text>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(C: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      backgroundColor: C.dark,
      paddingTop: Platform.OS === 'ios' ? 54 : 44,
      paddingBottom: 16,
      paddingHorizontal: 20,
    },
    title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    tabRow: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
    tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
    tabT: { fontSize: 14, color: C.muted, fontWeight: '500' },
    tabTActive: { color: C.primary, fontWeight: '700' },
    scroll: { padding: 16, gap: 14 },
    streakCard: {
      backgroundColor: C.isDark ? '#2D2008' : '#FFF8E1',
      borderRadius: 16, padding: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1.5, borderColor: '#F59E0B',
    },
    streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    streakFire: { fontSize: 32 },
    streakNum: { fontSize: 28, fontWeight: '900', color: '#F59E0B' },
    streakLabel: { fontSize: 12, color: '#854F0B', fontWeight: '500' },
    streakDesc: { fontSize: 13, fontWeight: '700', color: '#854F0B' },
    levelCard: {
      backgroundColor: C.white, borderRadius: 16, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    romanCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    romanText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
    levelTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 3 },
    levelXp: { fontSize: 12, color: C.muted, marginBottom: 8 },
    progressBg: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: {
      backgroundColor: C.white, borderRadius: 14, padding: 16,
      width: '47.5%', alignItems: 'center', gap: 4,
      shadowColor: '#000', shadowOpacity: 0.05, elevation: 1,
    },
    statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    statIconText: { fontSize: 13, fontWeight: '800' },
    statValue: { fontSize: 22, fontWeight: '800', color: C.text },
    statLabel: { fontSize: 12, color: C.text2, textAlign: 'center' },
    statSub: { fontSize: 10, color: C.muted, textAlign: 'center' },
    settingsCard: { backgroundColor: C.white, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { fontSize: 15, fontWeight: '600', color: C.text },
    infoCard: { backgroundColor: C.white, borderRadius: 14, padding: 16, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
    infoTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { fontSize: 13, color: C.muted },
    infoValue: { fontSize: 13, fontWeight: '600', color: C.text },
    resetBtn: { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
    resetBtnT: { fontSize: 13, color: C.muted, fontWeight: '500' },
    levelsDesc: { fontSize: 13, color: C.muted, lineHeight: 19, textAlign: 'center' },
    xpGuide: { backgroundColor: C.white, borderRadius: 14, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.05, elevation: 1 },
    xpGuideTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 4 },
    xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
    xpAction: { fontSize: 13, color: C.text2 },
    xpBadge: { fontSize: 13, fontWeight: '700' },
    levelRow: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.04, elevation: 1 },
    romanCircleSm: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    romanTextSm: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
    levelRowTitle: { fontSize: 15, fontWeight: '700', color: C.text },
    levelRowXp: { fontSize: 12, color: C.muted, marginTop: 2 },
    currentBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    lockIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    lockText: { fontSize: 16, fontWeight: '700' },
    doneIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    doneText: { fontSize: 16, fontWeight: '700' },
  });
}