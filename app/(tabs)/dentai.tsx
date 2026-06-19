import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/Colors';

export default function DentAIScreen() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Text style={s.title}>🧠 ДентИИ</Text>
        <View style={s.badge}><Text style={s.badgeText}>Скоро</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.hero}>
          <Text style={s.heroEmoji}>🧠</Text>
          <Text style={s.heroTitle}>Клинический ИИ-советник</Text>
          <Text style={s.heroSub}>Первый стоматологический ИИ на основе российских учебников и протоколов МЗ РФ</Text>
        </View>

        <View style={s.featuresCard}>
          <Text style={s.featuresTitle}>Что умеет ДентИИ</Text>
          {[
            { icon: '📚', title: 'Только проверенные источники', desc: 'Максимовский, Боровский, протоколы МЗ РФ, клинические рекомендации СтАР' },
            { icon: '🎯', title: 'Точные ответы с цитатами', desc: 'Указывает источник и страницу — никаких галлюцинаций и домыслов' },
            { icon: '⚡', title: 'Мгновенный поиск', desc: 'Дозировки, протоколы, дифференциальная диагностика — за секунды' },
            { icon: '🔒', title: 'Медицински верифицирован', desc: 'База знаний проверена практикующими стоматологами МГМСУ' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={s.featureIcon}><Text style={{ fontSize: 22 }}>{f.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.examplesCard}>
          <Text style={s.featuresTitle}>Примеры вопросов</Text>
          {[
            '«Какая доза артикаина при мандибулярной анестезии у ребёнка 8 лет?»',
            '«Дифференциальная диагностика острого пульпита и периодонтита»',
            '«Протокол лечения кариеса дентина по Максимовскому»',
            '«Противопоказания к удалению зуба при приёме варфарина»',
          ].map((q, i) => (
            <View key={i} style={s.exampleRow}>
              <Text style={s.exampleDot}>→</Text>
              <Text style={s.exampleText}>{q}</Text>
            </View>
          ))}
        </View>

        <View style={s.pricingCard}>
          <View style={s.pricingBadge}><Text style={s.pricingBadgeText}>ПРЕМИУМ</Text></View>
          <Text style={s.pricingPrice}>499 ₽<Text style={s.pricingPer}> / месяц</Text></Text>
          <Text style={s.pricingDesc}>Безлимитные запросы · Все источники · Приоритетные обновления</Text>
        </View>

        {!submitted ? (
          <View style={s.waitlistCard}>
            <Text style={s.waitlistTitle}>🔔 Узнать первым о запуске</Text>
            <Text style={s.waitlistDesc}>Оставьте email — уведомим когда ДентИИ станет доступен и дадим скидку 50% на первый месяц</Text>
            {!showForm ? (
              <TouchableOpacity style={s.btnP} onPress={() => setShowForm(true)}>
                <Text style={s.btnPT}>Хочу попасть в список ожидания</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.formWrap}>
                <TextInput
                  style={s.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Ваш email"
                  placeholderTextColor={C.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[s.btnP, { opacity: email.includes('@') ? 1 : 0.5 }]}
                  onPress={() => { if (email.includes('@')) setSubmitted(true); }}
                  disabled={!email.includes('@')}
                >
                  <Text style={s.btnPT}>Записаться ✓</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={[s.waitlistCard, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
            <Text style={s.waitlistTitle}>Вы в списке!</Text>
            <Text style={s.waitlistDesc}>Уведомим вас о запуске и пришлём промокод на скидку 50%</Text>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.dark,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { color: C.white, fontSize: 22, fontWeight: '800' },
  badge: { backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText: { color: C.dark, fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  hero: { backgroundColor: C.dark, borderRadius: 20, padding: 28, alignItems: 'center' },
  heroEmoji: { fontSize: 56, marginBottom: 12 },
  heroTitle: { color: C.white, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  featuresCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2, gap: 14 },
  featuresTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 3 },
  featureDesc: { fontSize: 12, color: C.muted, lineHeight: 17 },
  examplesCard: { backgroundColor: C.white, borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2, gap: 10 },
  exampleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  exampleDot: { color: C.primary, fontWeight: '700', fontSize: 14, marginTop: 1 },
  exampleText: { fontSize: 13, color: C.text2, lineHeight: 19, flex: 1, fontStyle: 'italic' },
  pricingCard: { backgroundColor: C.primary, borderRadius: 16, padding: 20, alignItems: 'center', gap: 8 },
  pricingBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  pricingBadgeText: { color: C.white, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  pricingPrice: { color: C.white, fontSize: 36, fontWeight: '900' },
  pricingPer: { fontSize: 16, fontWeight: '400', color: 'rgba(255,255,255,0.8)' },
  pricingDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  waitlistCard: { backgroundColor: C.white, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.06, elevation: 2, gap: 12 },
  waitlistTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  waitlistDesc: { fontSize: 13, color: C.muted, lineHeight: 19 },
  formWrap: { gap: 10 },
  input: { backgroundColor: C.bg, borderRadius: 12, padding: 14, fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border },
  btnP: { backgroundColor: C.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPT: { color: C.white, fontSize: 14, fontWeight: '700' },
});