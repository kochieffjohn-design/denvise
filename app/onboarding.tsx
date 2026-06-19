import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
    Dimensions,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { C } from '../constants/Colors';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    tag: 'ДОБРО ПОЖАЛОВАТЬ',
    title: 'Тренажёр\nстоматолога',
    subtitle: 'Клинические кейсы, протоколы и симуляция пациентов — всё в одном приложении.',
    accent: C.accent,
    visual: {
      lines: ['Диагностика', 'Коммуникация', 'Протоколы', 'Экзамен'],
    },
  },
  {
    id: 2,
    tag: '6 МОДУЛЕЙ',
    title: 'Учитесь на\nреальных кейсах',
    subtitle: 'Кариес, пульпит, периодонтит и редкие ловушки — три уровня сложности с разбором каждой ошибки.',
    accent: '#34d399',
    visual: {
      levels: [
        { label: 'Начальный', count: '5 кейсов', color: '#34d399' },
        { label: 'Средний', count: '9 кейсов', color: '#f59e0b' },
        { label: 'Сложный', count: '5 кейсов', color: '#f87171' },
      ],
    },
  },
  {
    id: 3,
    tag: 'КОММУНИКАЦИЯ',
    title: 'Тренируйте\nразговор с пациентом',
    subtitle: '8 типов пациентов — тревожный, агрессивный, VIP, ребёнок. Пишите ответ — ИИ оценит.',
    accent: '#a78bfa',
    visual: {
      patients: [
        { label: 'Тревожный', initial: 'Т' },
        { label: 'VIP', initial: 'V' },
        { label: 'Агрессивный', initial: 'А' },
        { label: 'Пожилой', initial: 'П' },
      ],
    },
  },
  {
    id: 4,
    tag: 'ПРОГРЕСС',
    title: 'Растите\nвместе с Denvise',
    subtitle: 'От интерна до владельца клиники — 7 уровней мастерства. Каждый кейс приближает к следующему.',
    accent: '#f59e0b',
    visual: {
      levels2: [
        { roman: 'I', title: 'Интерн', color: '#94a3b8', active: true },
        { roman: 'II', title: 'Ординатор', color: '#60a5fa', active: false },
        { roman: 'III', title: 'Врач', color: '#34d399', active: false },
        { roman: 'VII', title: 'Владелец клиники', color: '#1565c0', active: false },
      ],
    },
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const goTo = (index: number) => {
    setCurrent(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const finish = async () => {
    await AsyncStorage.setItem('denvise_onboarded', '1');
    router.replace('/(tabs)');
  };

  const next = () => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      finish();
    }
  };

  const skip = () => finish();

  const slide = SLIDES[current];

  return (
    <View style={s.container}>

      <View style={s.topBar}>
        <TouchableOpacity onPress={skip} style={s.skipBtn}>
          <Text style={s.skipText}>Пропустить</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, i) => (
          <View key={sl.id} style={s.slide}>

            <View style={s.visualArea}>
              {i === 0 && (
                <View style={s.v0}>
                  <View style={[s.v0Logo, { borderColor: sl.accent }]}>
                    <Text style={s.v0LogoText}>Den</Text>
                    <Text style={[s.v0LogoAccent, { color: sl.accent }]}>vise</Text>
                  </View>
                  <View style={s.v0Lines}>
                    {sl.visual.lines!.map((line, li) => (
                      <View key={li} style={[s.v0Line, { opacity: 1 - li * 0.18 }]}>
                        <View style={[s.v0Dot, { backgroundColor: sl.accent }]} />
                        <Text style={s.v0LineText}>{line}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {i === 1 && (
                <View style={s.v1}>
                  {sl.visual.levels!.map((lv, li) => (
                    <View key={li} style={s.v1Row}>
                      <View style={s.v1Labels}>
                        <Text style={s.v1Label}>{lv.label}</Text>
                        <Text style={[s.v1Count, { color: lv.color }]}>{lv.count}</Text>
                      </View>
                      <View style={[s.v1Bar, { backgroundColor: lv.color, width: `${55 + li * 15}%` as any }]} />
                    </View>
                  ))}
                </View>
              )}

              {i === 2 && (
                <View style={s.v2}>
                  <View style={s.v2Grid}>
                    {sl.visual.patients!.map((p, pi) => (
                      <View key={pi} style={s.v2Card}>
                        <View style={[s.v2Circle, { backgroundColor: sl.accent + '22' }]}>
                          <Text style={[s.v2Initial, { color: sl.accent }]}>{p.initial}</Text>
                        </View>
                        <Text style={s.v2Label}>{p.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[s.v2Chat, { borderColor: sl.accent + '44' }]}>
                    <View style={s.v2Bubble}>
                      <Text style={s.v2BubbleText}>Я очень боюсь боли...</Text>
                    </View>
                    <View style={[s.v2BubbleDoc, { backgroundColor: sl.accent }]}>
                      <Text style={s.v2BubbleDocText}>Понимаю. Сначала просто поговорим.</Text>
                    </View>
                  </View>
                </View>
              )}

              {i === 3 && (
                <View style={s.v3}>
                  {sl.visual.levels2!.map((lv, li) => (
                    <View key={li} style={[s.v3Row, { opacity: lv.active ? 1 : 0.35 }]}>
                      <View style={[s.v3Circle, { backgroundColor: lv.active ? lv.color : '#374151' }]}>
                        <Text style={[s.v3Roman, { color: lv.active ? C.white : '#6b7280' }]}>{lv.roman}</Text>
                      </View>
                      <Text style={[s.v3Title, { color: lv.active ? C.white : 'rgba(255,255,255,0.4)' }]}>{lv.title}</Text>
                      {lv.active && (
                        <View style={[s.v3CurrentBadge, { backgroundColor: lv.color }]}>
                          <Text style={s.v3CurrentText}>Текущий</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  <View style={s.v3Progress}>
                    <Text style={s.v3ProgressLabel}>0 XP · до следующего уровня 200 XP</Text>
                    <View style={s.v3ProgressBg}>
                      <View style={[s.v3ProgressFill, { backgroundColor: sl.accent }]} />
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={s.textArea}>
              <Text style={[s.tag, { color: sl.accent }]}>{sl.tag}</Text>
              <Text style={s.title}>{sl.title}</Text>
              <Text style={s.subtitle}>{sl.subtitle}</Text>
            </View>

          </View>
        ))}
      </ScrollView>

      <View style={s.bottom}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <View style={[
                s.dot,
                i === current && s.dotActive,
                i === current && { backgroundColor: slide.accent },
              ]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: slide.accent }]} onPress={next} activeOpacity={0.85}>
          <Text style={s.nextText}>
            {current === SLIDES.length - 1 ? 'Начать' : 'Далее'}
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.dark },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  skipText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '500' },
  slide: { width, flex: 1 },
  visualArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // Slide 0
  v0: { alignItems: 'center', gap: 36, width: '100%' },
  v0Logo: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  v0LogoText: { color: C.white, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  v0LogoAccent: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  v0Lines: { width: '100%', gap: 14 },
  v0Line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  v0Dot: { width: 6, height: 6, borderRadius: 3 },
  v0LineText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontWeight: '500' },

  // Slide 1
  v1: { width: '100%', gap: 20 },
  v1Row: { gap: 8 },
  v1Labels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  v1Label: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  v1Count: { fontSize: 13, fontWeight: '700' },
  v1Bar: { height: 8, borderRadius: 4 },

  // Slide 2
  v2: { width: '100%', gap: 24 },
  v2Grid: { flexDirection: 'row', justifyContent: 'space-around' },
  v2Card: { alignItems: 'center', gap: 8 },
  v2Circle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  v2Initial: { fontSize: 22, fontWeight: '800' },
  v2Label: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500' },
  v2Chat: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  v2Bubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    padding: 10,
    maxWidth: '70%',
  },
  v2BubbleText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  v2BubbleDoc: {
    alignSelf: 'flex-end',
    borderRadius: 12,
    borderBottomRightRadius: 3,
    padding: 10,
    maxWidth: '75%',
  },
  v2BubbleDocText: { color: C.white, fontSize: 13, fontWeight: '500' },

  // Slide 3
  v3: { width: '100%', gap: 10 },
  v3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  v3Circle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  v3Roman: { fontSize: 14, fontWeight: '800' },
  v3Title: { fontSize: 15, fontWeight: '600', flex: 1 },
  v3CurrentBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  v3CurrentText: { color: C.white, fontSize: 10, fontWeight: '700' },
  v3Progress: { gap: 8, marginTop: 8 },
  v3ProgressLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' },
  v3ProgressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  v3ProgressFill: { height: 4, width: '5%', borderRadius: 2 },

  // Text
  textArea: { paddingHorizontal: 28, paddingBottom: 8, gap: 10 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: C.white, fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -0.5 },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 22 },

  // Bottom
  bottom: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 20, height: 6, borderRadius: 3 },
  nextBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  nextText: { color: C.white, fontSize: 16, fontWeight: '700' },
});