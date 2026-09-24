import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/Colors';

const FEATURES = [
  {
    icon: 'book-open-outline',
    lib: 'MaterialCommunityIcons',
    title: 'Только проверенные источники',
    desc: 'Максимовский, Боровский, протоколы МЗ РФ, клинические рекомендации СтАР',
    color: '#3A6FD8',
    bg: '#ECF1FB',
  },
  {
    icon: 'target',
    lib: 'MaterialCommunityIcons',
    title: 'Точные ответы с цитатами',
    desc: 'Указывает источник и страницу — никаких галлюцинаций и домыслов',
    color: '#2E9C78',
    bg: '#E8F6F0',
  },
  {
    icon: 'flash-outline',
    lib: 'Ionicons',
    title: 'Мгновенный поиск',
    desc: 'Дозировки, протоколы, дифдиагностика — за секунды',
    color: '#BC8F37',
    bg: '#F8F2E2',
  },
  {
    icon: 'shield-check-outline',
    lib: 'MaterialCommunityIcons',
    title: 'Медицински верифицирован',
    desc: 'База знаний проверена практикующими стоматологами МГМСУ',
    color: '#7A5BD0',
    bg: '#F0ECFB',
  },
];

const EXAMPLES = [
  'Доза артикаина при мандибулярной анестезии у ребёнка 8 лет?',
  'Дифференциальная диагностика острого пульпита и периодонтита',
  'Протокол лечения кариеса дентина по Максимовскому',
  'Противопоказания к удалению зуба при приёме варфарина',
];

export default function DentAIScreen() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Хедер */}
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={s.header}>
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.headerRow}>
          <View style={s.headerIconWrap}>
            <MaterialCommunityIcons name="brain" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>ДентИИ</Text>
            <Text style={s.titleSub}>Клинический ИИ-советник</Text>
          </View>
          <View style={s.soonBadge}>
            <Text style={s.soonBadgeT}>Скоро</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Герой */}
        <LinearGradient colors={[C.navyBase, '#232E52']} style={s.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.heroGlow} pointerEvents="none" />
          <View style={s.heroBadgeWrap}>
            <View style={s.heroBadge}>
              <MaterialCommunityIcons name="brain" size={16} color={C.primary500} />
              <Text style={s.heroBadgeT}>RAG · Российские источники</Text>
            </View>
          </View>
          <Text style={s.heroTitle}>Первый стоматологический{'\n'}ИИ на основе протоколов МЗ РФ</Text>
          <Text style={s.heroSub}>Спроси о дозировке, протоколе или дифдиагностике — получи ответ с указанием источника и страницы</Text>
        </LinearGradient>

        {/* Фичи */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Что умеет ДентИИ</Text>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={[s.featureIcon, { backgroundColor: f.bg, position: 'relative', overflow: 'hidden' }]}>
                <View style={s.featureIconBlick} />
                {f.lib === 'Ionicons'
                  ? <Ionicons name={f.icon as any} size={20} color={f.color} />
                  : <MaterialCommunityIcons name={f.icon as any} size={20} color={f.color} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Примеры */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Примеры вопросов</Text>
          {EXAMPLES.map((q, i) => (
            <View key={i} style={s.exampleRow}>
              <View style={s.exampleDot}>
                <Ionicons name="arrow-forward" size={12} color={C.primary500} />
              </View>
              <Text style={s.exampleText}>«{q}»</Text>
            </View>
          ))}
        </View>

        {/* Цена */}
        <LinearGradient colors={[C.primary600, C.primary500]} style={s.pricingCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.pricingTopRow}>
            <View style={s.pricingBadge}>
              <Text style={s.pricingBadgeT}>ПРЕМИУМ</Text>
            </View>
          </View>
          <Text style={s.pricingPrice}>399 ₽<Text style={s.pricingPer}> / месяц</Text></Text>
          <View style={s.pricingFeatures}>
            {['Безлимитные запросы', 'Все источники', 'Приоритетные обновления'].map((f, i) => (
              <View key={i} style={s.pricingFeatureRow}>
                <Ionicons name="checkmark-circle" size={15} color="rgba(255,255,255,0.9)" />
                <Text style={s.pricingFeatureT}>{f}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Вейтлист */}
        {!submitted ? (
          <View style={s.waitlistCard}>
            <View style={s.waitlistIcon}>
              <Ionicons name="notifications-outline" size={22} color={C.primary500} />
            </View>
            <Text style={s.waitlistTitle}>Узнать первым о запуске</Text>
            <Text style={s.waitlistDesc}>Оставьте email — уведомим когда ДентИИ станет доступен и дадим скидку 50% на первый месяц</Text>
            {!showForm ? (
              <TouchableOpacity style={s.btnP} onPress={() => setShowForm(true)} activeOpacity={0.85}>
                <LinearGradient colors={[C.primary500, C.primary600]} style={s.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={s.btnPT}>Хочу попасть в список ожидания</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={s.formWrap}>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Ваш email"
                  placeholderTextColor={C.n400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[s.btnP, { opacity: email.includes('@') ? 1 : 0.4 }]}
                  onPress={() => { if (email.includes('@')) setSubmitted(true); }}
                  disabled={!email.includes('@')}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[C.primary500, C.primary600]} style={s.btnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={s.btnPT}>Записаться</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={[s.waitlistCard, { alignItems: 'center' }]}>
            <View style={[s.waitlistIcon, { backgroundColor: '#E8F6F0', marginBottom: 8 }]}>
              <Ionicons name="checkmark-circle" size={22} color="#2E9C78" />
            </View>
            <Text style={[s.waitlistTitle, { textAlign: 'center' }]}>Вы в списке!</Text>
            <Text style={[s.waitlistDesc, { textAlign: 'center' }]}>Уведомим о запуске и пришлём промокод на скидку 50%</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Хедер
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  headerGlow: { position: 'absolute', top: -50, right: -30, width: 150, height: 150, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.25)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  titleSub: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 },
  soonBadge: { backgroundColor: C.primary50, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  soonBadgeT: { color: C.primary600, fontSize: 12, fontWeight: '700' },

  // Герой
  hero: { borderRadius: 20, padding: 24, overflow: 'hidden', position: 'relative', gap: 12 },
  heroGlow: { position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.20)' },
  heroBadgeWrap: { flexDirection: 'row' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  heroBadgeT: { color: C.accent, fontSize: 11, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 28, letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 },

  // Карточки
  scroll: { padding: 14, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 18, shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, gap: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.n900, letterSpacing: -0.2 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureIconBlick: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.35)', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: C.n900, marginBottom: 3 },
  featureDesc: { fontSize: 12, color: C.n500, lineHeight: 17 },
  exampleRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  exampleDot: { width: 22, height: 22, borderRadius: 7, backgroundColor: C.primary50, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  exampleText: { fontSize: 13, color: C.n700, lineHeight: 19, flex: 1, fontStyle: 'italic' },

  // Цена
  pricingCard: { borderRadius: 18, padding: 22, gap: 12 },
  pricingTopRow: { flexDirection: 'row' },
  pricingBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  pricingBadgeT: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pricingPrice: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  pricingPer: { fontSize: 16, fontWeight: '400', color: 'rgba(255,255,255,0.75)' },
  pricingFeatures: { gap: 8 },
  pricingFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pricingFeatureT: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },

  // Вейтлист
  waitlistCard: { backgroundColor: C.card, borderRadius: 18, padding: 20, shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, gap: 10 },
  waitlistIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.primary50, alignItems: 'center', justifyContent: 'center' },
  waitlistTitle: { fontSize: 16, fontWeight: '800', color: C.n900 },
  waitlistDesc: { fontSize: 13, color: C.n500, lineHeight: 19 },
  formWrap: { gap: 10 },
  input: { backgroundColor: C.sunk, borderRadius: 14, padding: 14, fontSize: 14, color: C.n900, borderWidth: 1.5, borderColor: C.border },
  btnP: { borderRadius: 14, overflow: 'hidden' },
  btnGrad: { paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  btnPT: { color: '#fff', fontSize: 14, fontWeight: '700' },
});