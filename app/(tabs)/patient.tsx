import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { C } from '../../constants/Colors';
import { PATIENTS } from '../../data/clinicalData';
import { DENTAI_API_URL } from '../../constants/config';

type Msg = { role: 'user' | 'assistant'; content: string };

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
    if (l.includes('понима') || l.includes('слышу')) setFb('✅ Эмпатия установлена — пациент чувствует, что его слышат.');
    else if (l.includes('поднимите руку') || l.includes('остановлюсь')) setFb('✅ Стоп-сигнал даёт пациенту контроль — снижает страх.');
    else if (l.includes('анестез')) setFb('✅ Ранняя информация об анестезии снижает тревогу.');
    else if (l.includes('не бойтесь')) setFb('⚠️ «Не бойтесь» не убирает страх. Лучше: «Вы в надёжных руках».');
    else if (l.includes('больно не будет')) setFb('❌ Нельзя гарантировать. Лучше: «Сделаем максимально комфортно».');
    else setFb('💡 Используйте эмпатию, конкретику и стоп-сигнал.');
    try {
      const r = await fetch(`${DENTAI_API_URL}/api/patient/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: pat.id, messages: next }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsgs([...next, { role: 'assistant', content: d?.error || '(ошибка сервера)' }]);
      } else {
        setMsgs([...next, { role: 'assistant', content: d.answer || '...' }]);
      }
    } catch { setMsgs([...next, { role: 'assistant', content: '(нет связи)' }]); }
    finally { setLoading(false); setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 100); }
  };

  if (!pat) return (
    <View style={s.container}>
      <View style={s.hdr}><Text style={s.title}>🤖 ИИ-Пациент</Text><Text style={s.sub}>Выберите психотип</Text></View>
      <ScrollView contentContainerStyle={s.grid}>
        {PATIENTS.map(p => (
          <TouchableOpacity key={p.id} style={s.pc} onPress={() => select(p)} activeOpacity={0.7}>
            <Text style={s.pav}>{p.avatar}</Text>
            <Text style={s.pnm}>{p.name}</Text>
            <Text style={s.ptp}>{p.type}</Text>
            <View style={[s.ptag, { backgroundColor: p.tagBg }]}><Text style={[s.ptagT, { color: p.tagColor }]}>{p.tagText}</Text></View>
            {p.traits.slice(0, 2).map((t, i) => <Text key={i} style={s.trait}>• {t}</Text>)}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => setPat(null)} style={s.back}><Text style={s.backT}>← Назад</Text></TouchableOpacity>
        <Text style={s.title}>{pat.avatar} {pat.name}</Text>
      </View>
      <View style={s.traitsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pat.traits.map((t, i) => <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>)}
        </ScrollView>
      </View>
      <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {msgs.map((m, i) => (
          <View key={i} style={[s.mw, m.role === 'user' ? s.mr : s.ml]}>
            <Text style={s.mn}>{m.role === 'user' ? '👨‍⚕️ Врач' : pat.avatar}</Text>
            <View style={[s.bub, m.role === 'user' ? s.bDoc : s.bPat]}>
              <Text style={[s.bubT, m.role === 'user' && s.bubTDoc]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && <View style={s.ml}><View style={s.bPat}><ActivityIndicator size="small" color={C.muted} /></View></View>}
      </ScrollView>
      {fb ? <View style={s.fb}><Text style={s.fbT}>{fb}</Text></View> : null}
      <View style={s.qr}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pat.quickReplies.map((r, i) => <TouchableOpacity key={i} style={s.qrb} onPress={() => setInput(r)}><Text style={s.qrT}>{r}</Text></TouchableOpacity>)}
        </ScrollView>
      </View>
      <View style={s.inp}>
        <TextInput style={s.ti} value={input} onChangeText={setInput} placeholder="Ответьте пациенту..." placeholderTextColor={C.muted} multiline />
        <TouchableOpacity style={s.sb} onPress={send} disabled={loading}><Text style={s.sbT}>↑</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: { backgroundColor: C.dark, paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  back: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 12 },
  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pc: { backgroundColor: C.white, borderRadius: 14, padding: 13, width: '47%', shadowColor: '#000', shadowOpacity: 0.06, elevation: 2 },
  pav: { fontSize: 30, marginBottom: 6, textAlign: 'center' },
  pnm: { fontSize: 13, fontWeight: '700', color: C.text, textAlign: 'center' },
  ptp: { fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 2 },
  ptag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'center', marginTop: 5 },
  ptagT: { fontSize: 10, fontWeight: '700' },
  trait: { fontSize: 10, color: C.text2, marginTop: 3 },
  traitsBar: { backgroundColor: C.dark, paddingBottom: 8, paddingHorizontal: 12 },
  chip: { backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginRight: 6 },
  chipT: { color: C.white, fontSize: 10 },
  mw: { marginBottom: 10, maxWidth: '78%' },
  ml: { alignSelf: 'flex-start' },
  mr: { alignSelf: 'flex-end' },
  mn: { fontSize: 10, color: C.muted, marginBottom: 2 },
  bub: { borderRadius: 14, padding: 10 },
  bPat: { backgroundColor: C.white, borderBottomLeftRadius: 3, shadowColor: '#000', shadowOpacity: 0.06, elevation: 1 },
  bDoc: { backgroundColor: C.primary, borderBottomRightRadius: 3 },
  bubT: { fontSize: 13, lineHeight: 19, color: C.text },
  bubTDoc: { color: C.white },
  fb: { backgroundColor: C.successBg, borderTopWidth: 1, borderTopColor: '#86efac', padding: 12 },
  fbT: { fontSize: 12, color: '#166534', lineHeight: 17 },
  qr: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.white },
  qrb: { backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  qrT: { fontSize: 11, color: C.primary, fontWeight: '600' },
  inp: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  ti: { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: C.text, maxHeight: 80 },
  sb: { backgroundColor: C.primary, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sbT: { color: C.white, fontSize: 20, fontWeight: '700' },
});
