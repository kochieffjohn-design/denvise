import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { C } from '../../constants/Colors';
import { PATIENTS } from '../../data/clinicalData';

const API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';
type Msg = { role: 'user' | 'assistant'; content: string };

// Сопоставление тега психотипа → иконка + цвета (вместо эмодзи)
const TAG_STYLE: Record<string, { icon: string; solid: string; tint: string }> = {
  'Тревожный': { icon: 'pulse-outline',         solid: '#E0A53A', tint: '#F8F2E2' },
  'Пожилой':   { icon: 'person-outline',        solid: '#3A6FD8', tint: '#ECF1FB' },
  'VIP':       { icon: 'briefcase-outline',     solid: '#BC8F37', tint: '#F8F2E2' },
  'Детский':   { icon: 'happy-outline',         solid: '#C0547D', tint: '#FBECF2' },
  'Фобия':     { icon: 'alert-circle-outline',  solid: '#C2683F', tint: '#F9EFE9' },
  '2-е мнение':{ icon: 'help-circle-outline',   solid: '#2E9C78', tint: '#E8F6F0' },
};
const DEFAULT_TAG = { icon: 'person-outline', solid: C.primary500, tint: C.primary50 };
const tagStyle = (p: any) => TAG_STYLE[p.tagText] || DEFAULT_TAG;

export default function PatientScreen() {
  const [pat, setPat] = useState<typeof PATIENTS[0] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState('');
  const ref = useRef<ScrollView>(null);

  const select = (p: typeof PATIENTS[0]) => {
    setPat(p); setMsgs([{ role: 'assistant', content: p.complaint }]); setFb(''); setInput('');
  };

  const send = async () => {
    if (!input.trim() || !pat || loading) return;
    const txt = input.trim(); setInput('');
    const next: Msg[] = [...msgs, { role: 'user', content: txt }];
    setMsgs(next); setLoading(true);
    const l = txt.toLowerCase();
    if (l.includes('понима') || l.includes('слышу')) setFb('Эмпатия установлена — пациент чувствует, что его слышат.');
    else if (l.includes('поднимите руку') || l.includes('остановлюсь')) setFb('Стоп-сигнал даёт пациенту контроль — снижает страх.');
    else if (l.includes('анестез')) setFb('Ранняя информация об анестезии снижает тревогу.');
    else if (l.includes('не бойтесь')) setFb('«Не бойтесь» не убирает страх. Лучше: «Вы в надёжных руках».');
    else if (l.includes('больно не будет')) setFb('Нельзя гарантировать. Лучше: «Сделаем максимально комфортно».');
    else setFb('Используйте эмпатию, конкретику и стоп-сигнал.');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 150, system: pat.systemPrompt, messages: next }),
      });
      const d = await r.json();
      setMsgs([...next, { role: 'assistant', content: d.content?.[0]?.text || '...' }]);
    } catch { setMsgs([...next, { role: 'assistant', content: '(нет связи)' }]); }
    finally { setLoading(false); setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 100); }
  };

  // ── ВЫБОР ПАЦИЕНТА ──
  if (!pat) return (
    <View style={s.container}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={s.hdr}>
        <View style={s.headerGlow} pointerEvents="none" />
        <View style={s.dotGrid} pointerEvents="none">
          {Array.from({ length: 48 }).map((_, i) => <View key={i} style={s.dot} />)}
        </View>
        <View style={s.hdrRow}>
          <View style={s.hdrIcon}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>ИИ-Пациент</Text>
            <Text style={s.sub}>Выберите психотип</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {PATIENTS.map(p => {
          const ts = tagStyle(p);
          return (
            <TouchableOpacity key={p.id} style={s.pc} onPress={() => select(p)} activeOpacity={0.8}>
              <View style={[s.iconPlate, { backgroundColor: ts.tint }]}>
                <View style={s.iconPlateBlick} />
                <Ionicons name={ts.icon as any} size={22} color={ts.solid} />
              </View>
              <Text style={s.pnm}>{p.name}</Text>
              <Text style={s.ptp} numberOfLines={2}>{p.type}</Text>
              <View style={[s.ptag, { backgroundColor: ts.tint }]}>
                <Text style={[s.ptagT, { color: ts.solid }]}>{p.tagText}</Text>
              </View>
              {p.traits.slice(0, 2).map((t, i) => (
                <View key={i} style={s.traitRow}>
                  <View style={[s.traitDot, { backgroundColor: ts.solid }]} />
                  <Text style={s.trait}>{t}</Text>
                </View>
              ))}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );

  // ── ЧАТ ──
  const ts = tagStyle(pat);
  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <LinearGradient colors={[C.navyDeep, C.navyBase]} style={s.chatHdr}>
        <TouchableOpacity onPress={() => setPat(null)} style={s.back}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
          <Text style={s.backT}>Назад</Text>
        </TouchableOpacity>
        <View style={[s.chatHdrIcon, { backgroundColor: ts.tint }]}>
          <Ionicons name={ts.icon as any} size={18} color={ts.solid} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.chatHdrName}>{pat.name}</Text>
          <Text style={s.chatHdrType} numberOfLines={1}>{pat.type}</Text>
        </View>
      </LinearGradient>

      <View style={s.traitsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pat.traits.map((t, i) => (
            <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {msgs.map((m, i) => (
          <View key={i} style={[s.mw, m.role === 'user' ? s.mr : s.ml]}>
            <Text style={s.mn}>{m.role === 'user' ? 'Врач' : pat.name.split(' ')[0]}</Text>
            <View style={[s.bub, m.role === 'user' ? s.bDoc : s.bPat]}>
              <Text style={[s.bubT, m.role === 'user' && s.bubTDoc]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && <View style={s.ml}><View style={[s.bub, s.bPat]}><ActivityIndicator size="small" color={C.muted} /></View></View>}
      </ScrollView>

      {fb ? (
        <View style={s.fb}>
          <Ionicons name="bulb-outline" size={15} color="#0E6E4C" />
          <Text style={s.fbT}>{fb}</Text>
        </View>
      ) : null}

      <View style={s.qr}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pat.quickReplies.map((r, i) => (
            <TouchableOpacity key={i} style={s.qrb} onPress={() => setInput(r)}>
              <Text style={s.qrT}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={s.inp}>
        <TextInput
          style={s.ti}
          value={input}
          onChangeText={setInput}
          placeholder="Ответьте пациенту..."
          placeholderTextColor={C.muted}
          multiline
        />
        <TouchableOpacity style={[s.sb, { opacity: input.trim() ? 1 : 0.4 }]} onPress={send} disabled={loading || !input.trim()}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Хедер выбора
  hdr: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 16, paddingHorizontal: 18, overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -50, right: -30, width: 150, height: 150,
    borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.30)',
  },
  dotGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', flexWrap: 'wrap', opacity: 0.4 },
  dot: { width: 15, height: 15 },
  hdrRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hdrIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  title: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 1 },

  grid: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pc: {
    backgroundColor: C.card, borderRadius: 18, padding: 14, width: '47.5%',
    shadowColor: C.n900, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  iconPlate: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden', marginBottom: 10,
  },
  iconPlateBlick: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
  },
  pnm: { fontSize: 14, fontWeight: '800', color: C.n900, letterSpacing: -0.2 },
  ptp: { fontSize: 11, color: C.n500, marginTop: 2, lineHeight: 15 },
  ptag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 8 },
  ptagT: { fontSize: 10, fontWeight: '700' },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  traitDot: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  trait: { fontSize: 11, color: C.n700, flex: 1, lineHeight: 15 },

  // Хедер чата
  chatHdr: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 12, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  back: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  backT: { color: '#fff', fontSize: 13, fontWeight: '500' },
  chatHdrIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chatHdrName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  chatHdrType: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 },

  traitsBar: { backgroundColor: C.navyBase, paddingBottom: 10, paddingHorizontal: 12 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginRight: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  chipT: { color: '#fff', fontSize: 10, fontWeight: '500' },

  mw: { marginBottom: 12, maxWidth: '80%' },
  ml: { alignSelf: 'flex-start' },
  mr: { alignSelf: 'flex-end' },
  mn: { fontSize: 10, color: C.n400, marginBottom: 3, marginLeft: 2, fontWeight: '600' },
  bub: { borderRadius: 16, padding: 12 },
  bPat: {
    backgroundColor: C.card, borderBottomLeftRadius: 4,
    shadowColor: C.n900, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  bDoc: { backgroundColor: C.primary500, borderBottomRightRadius: 4 },
  bubT: { fontSize: 13, lineHeight: 19, color: C.n900 },
  bubTDoc: { color: '#fff' },

  fb: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EAF8F1', borderTopWidth: 1, borderTopColor: '#BFE6D4', padding: 12,
  },
  fbT: { fontSize: 12, color: '#0E6E4C', lineHeight: 17, flex: 1 },

  qr: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.card },
  qrb: {
    backgroundColor: C.primary50, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
  },
  qrT: { fontSize: 11, color: C.primary600, fontWeight: '600' },

  inp: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border, alignItems: 'flex-end' },
  ti: {
    flex: 1, backgroundColor: C.sunk, borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 13, color: C.n900, maxHeight: 90,
    borderWidth: 1, borderColor: C.border,
  },
  sb: { backgroundColor: C.primary500, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});