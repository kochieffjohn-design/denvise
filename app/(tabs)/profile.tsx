import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { C } from '../../constants/Colors';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { authEnabled, useSession } from '../../lib/session';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { useProgress } from '../../lib/progress';

const LEVELS = [
  { level: 1, title: 'Интерн',           minXp: 0,    maxXp: 199,  roman: 'I',    c1: '#94A3B8', c2: '#CBD5E1' },
  { level: 2, title: 'Ассистент',        minXp: 200,  maxXp: 499,  roman: 'II',   c1: '#60A5FA', c2: '#93C5FD' },
  { level: 3, title: 'Ординатор',        minXp: 500,  maxXp: 999,  roman: 'III',  c1: '#3A6FD8', c2: '#6FA0F0' },
  { level: 4, title: 'Врач',             minXp: 1000, maxXp: 1499, roman: 'IV',   c1: '#2E9C78', c2: '#5BC79E' },
  { level: 5, title: 'Специалист',       minXp: 1500, maxXp: 3499, roman: 'V',    c1: '#BC8F37', c2: '#E0B65E' },
  { level: 6, title: 'Эксперт',          minXp: 3500, maxXp: 4499, roman: 'VI',   c1: '#C2683F', c2: '#E08A5F' },
  { level: 7, title: 'Владелец клиники', minXp: 4500, maxXp: 99999,roman: 'VII',  c1: '#D4AF37', c2: '#F4D571' },
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

function Medallion({ level, size = 62, locked = false }: { level: typeof LEVELS[0]; size?: number; locked?: boolean }) {
  const colors = locked ? ['#E3E8EF', '#C3CAD7'] : [level.c1, level.c2];
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={colors as any}
        start={{ x: 0.32, y: 0.25 }}
        end={{ x: 0.8, y: 1 }}
        style={[
          medal.base,
          { width: size, height: size, borderRadius: size / 2 },
          !locked && { shadowColor: level.c1, shadowOpacity: 0.34, shadowRadius: size * 0.22, shadowOffset: { width: 0, height: size * 0.1 } },
        ]}
      >
        <View style={[medal.ring, { borderRadius: size / 2 }]} />
        <View style={[medal.topLight, { borderRadius: size / 2, height: size * 0.5 }]} />
        <Text style={[medal.roman, { fontSize: size * 0.32, color: locked ? '#94A3B8' : '#fff' }]}>
          {level.roman}
        </Text>
        {level.level === 7 && !locked && (
          <View style={medal.halo} pointerEvents="none" />
        )}
      </LinearGradient>
    </View>
  );
}

/** Сброс стирает прогресс и в аккаунте — только после подтверждения. */
function confirmReset(reset: () => Promise<void>) {
  const title = 'Сбросить весь прогресс?';
  const message = 'Опыт, серия дней и пройденные задания удалятся из аккаунта на всех устройствах. Отменить это нельзя.';
  const run = () =>
    reset().catch(() => {
      const err = 'Не удалось сбросить: нет связи с сервером. Попробуйте, когда появится интернет.';
      if (Platform.OS === 'web') window.alert(err);
      else Alert.alert('Ошибка', err);
    });
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Сбросить', style: 'destructive', onPress: run },
  ]);
}

export default function ProfileScreen() {
  const headerTop = useHeaderTopPadding();
  const offlineStatus = useOfflineStatus();
  const { user, signOut } = useSession();
  const [tab, setTab] = useState<'profile' | 'levels'>('profile');
  const { stats, reset } = useProgress();

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
    { label: 'Диагностика',  value: `${stats.diagCases}`,     sub: 'кейсов',    icon: 'Dx', color: '#3A6FD8', bg: '#ECF1FB' },
    { label: 'Коммуникация', value: `${stats.commScenarios}`, sub: 'сценариев', icon: 'Cm', color: '#C0547D', bg: '#FBECF2' },
    { label: 'Экзамены',     value: `${stats.exams}`,         sub: 'пройдено',  icon: 'Ex', color: '#BC8F37', bg: '#F8F2E2' },
    { label: 'XP набрано',   value: `${stats.xp}`,            sub: 'очков',     icon: 'XP', color: C.primary500, bg: C.primary50 },
  ];

  return (
    <View style={s.container}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={[s.header, { paddingTop: headerTop }]}>
        <View style={s.headerGlow} pointerEvents="none" />
        <Text style={s.title}>Профиль</Text>
      </LinearGradient>

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

          {/* Карточка уровня — медальон */}
          <View style={s.levelCard}>
            <Medallion level={currentLevel} size={62} />
            <View style={{ flex: 1 }}>
              <Text style={s.levelRank}>Ранг {currentLevel.roman}</Text>
              <Text style={s.levelTitle}>{currentLevel.title}</Text>
              <Text style={s.levelXp}>
                {nextLevel
                  ? `До ранга ${nextLevel.roman} — ${nextLevel.title}`
                  : 'Максимальный ранг'}
              </Text>
              <View style={s.progressBg}>
                <LinearGradient
                  colors={[currentLevel.c1, currentLevel.c2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[s.progressFill, { width: `${progressPct * 100}%` as any }]}
                >
                  <View style={s.progressInsetLight} />
                </LinearGradient>
              </View>
              <Text style={s.progressNumbers}>
                {xp.toLocaleString('ru-RU')} / {nextLevel ? nextLevel.minXp.toLocaleString('ru-RU') : '∞'} XP
              </Text>
            </View>
          </View>

          <Text style={s.sectionTitle}>Статистика</Text>
          <View style={s.statsGrid}>
            {STAT_ITEMS.map((st, i) => (
              <View key={i} style={[s.statCard]}>
                <View style={[s.statIconWrap, { backgroundColor: st.bg }]}>
                  <Text style={[s.statIconText, { color: st.color }]}>{st.icon}</Text>
                </View>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
                <Text style={s.statSub}>{st.sub}</Text>
              </View>
            ))}
          </View>

          {authEnabled && user && (
            <View style={s.infoCard}>
              <Text style={s.infoTitle}>Аккаунт</Text>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Почта</Text>
                <Text style={[s.infoValue, { flexShrink: 1, textAlign: 'right' }]}>{user.email}</Text>
              </View>
              <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
                <Text style={s.signOutBtnT}>Выйти</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.infoCard}>
            <Text style={s.infoTitle}>О приложении</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Версия</Text>
              <Text style={s.infoValue}>Denvise 4.0</Text>
            </View>
            {offlineStatus && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Работа без сети</Text>
                <Text style={[s.infoValue, { flexShrink: 1, textAlign: 'right' }]}>{offlineStatus}</Text>
              </View>
            )}
            <Text style={s.infoLabel}>ДентИИ отвечает на основе учебных материалов Denvise.</Text>
          </View>

          <TouchableOpacity style={s.resetBtn} onPress={() => confirmReset(reset)}>
            <Text style={s.resetBtnT}>Сбросить прогресс</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {tab === 'levels' && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.levelsDesc}>7 рангов — от Интерна до Владельца клиники</Text>

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
                <Text style={[s.xpBadge, { color: C.primary500 }]}>{item.xp}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Все ранги</Text>
          {LEVELS.map(lvl => {
            const isCurrent = lvl.level === currentLevel.level;
            const isUnlocked = xp >= lvl.minXp;
            return (
              <View key={lvl.level} style={[s.levelRow, isCurrent && { borderColor: lvl.c1, borderWidth: 1.5 }]}>
                <Medallion level={lvl} size={48} locked={!isUnlocked} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.levelRowTitle, !isUnlocked && { color: C.n400 }]}>{lvl.title}</Text>
                    {isCurrent && (
                      <View style={[s.currentBadge, { backgroundColor: lvl.c1 }]}>
                        <Text style={s.currentBadgeText}>Текущий</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.levelRowXp}>
                    {lvl.maxXp === 99999 ? `от ${lvl.minXp.toLocaleString('ru-RU')} XP` : `${lvl.minXp.toLocaleString('ru-RU')} – ${lvl.maxXp.toLocaleString('ru-RU')} XP`}
                  </Text>
                </View>
                {isUnlocked && !isCurrent && (
                  <View style={[s.doneIcon, { backgroundColor: lvl.c1 + '22' }]}>
                    <Text style={[s.doneText, { color: lvl.c1 }]}>✓</Text>
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

const medal = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' },
  topLight: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.32)' },
  roman: { fontWeight: '800', letterSpacing: 0.5 },
  halo: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)',
  },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -50, right: -30, width: 150, height: 150,
    borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.30)',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  tabRow: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary500 },
  tabT: { fontSize: 14, color: C.n500, fontWeight: '500' },
  tabTActive: { color: C.primary500, fontWeight: '700' },
  scroll: { padding: 16, gap: 14 },
  streakCard: {
    backgroundColor: '#FBF3E2', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: '#E0A53A',
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakFire: { fontSize: 32 },
  streakNum: { fontSize: 28, fontWeight: '900', color: '#E0A53A' },
  streakLabel: { fontSize: 12, color: '#8A5E1C', fontWeight: '500' },
  streakDesc: { fontSize: 13, fontWeight: '700', color: '#8A5E1C' },
  levelCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  levelRank: { fontSize: 11, fontWeight: '700', color: C.n400, textTransform: 'uppercase', letterSpacing: 0.5 },
  levelTitle: { fontSize: 18, fontWeight: '800', color: C.n900, marginBottom: 4 },
  levelXp: { fontSize: 12, color: C.n500, marginBottom: 8 },
  progressBg: { height: 8, backgroundColor: C.n200, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressInsetLight: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.3)' },
  progressNumbers: { fontSize: 11, color: C.n400, marginTop: 6, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.n500, letterSpacing: 0.5, textTransform: 'uppercase' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    width: '47.5%', alignItems: 'center', gap: 4,
    shadowColor: C.n900, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statIconText: { fontSize: 13, fontWeight: '800' },
  statValue: { fontSize: 22, fontWeight: '800', color: C.n900 },
  statLabel: { fontSize: 12, color: C.n700, textAlign: 'center' },
  statSub: { fontSize: 10, color: C.n400, textAlign: 'center' },
  infoCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 10 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: C.n900, marginBottom: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: C.n400 },
  infoValue: { fontSize: 13, fontWeight: '600', color: C.n900 },
  resetBtn: { borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  resetBtnT: { fontSize: 13, color: C.n500, fontWeight: '500' },
  signOutBtn: { marginTop: 4, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: C.light },
  signOutBtnT: { fontSize: 14, color: C.primary, fontWeight: '700' },
  levelsDesc: { fontSize: 13, color: C.n500, lineHeight: 19, textAlign: 'center' },
  xpGuide: { backgroundColor: C.card, borderRadius: 16, padding: 16, gap: 8 },
  xpGuideTitle: { fontSize: 14, fontWeight: '700', color: C.n900, marginBottom: 4 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  xpAction: { fontSize: 13, color: C.n700 },
  xpBadge: { fontSize: 13, fontWeight: '700' },
  levelRow: {
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C.border,
  },
  levelRowTitle: { fontSize: 15, fontWeight: '700', color: C.n900 },
  levelRowXp: { fontSize: 12, color: C.n400, marginTop: 2 },
  currentBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  doneIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 16, fontWeight: '700' },
});