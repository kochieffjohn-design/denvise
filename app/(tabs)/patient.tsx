import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TypingDots } from '../../components/Skeleton';
import { TouchableOpacity } from '../../components/Touchable';
import { useScreenTransition } from '../../components/ScreenTransition';
import { C } from '../../constants/Colors';
import { useOnline } from '../../hooks/useOnline';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { aiPost, errorText } from '../../lib/api';
import { PATIENTS } from '../../data/clinicalData';
import { useProgress } from '../../lib/progress';
import { useRouter } from 'expo-router';
import { ProBadge } from '../../components/ProBadge';
import { FREE_PATIENT_IDS } from '../../data/proCatalog';
import { onLockedPress, useProContent } from '../../lib/content';
import { authEnabled } from '../../lib/session';

// isError — служебная плашка об ошибке, а не реплика пациента: модели не отправляется.
type Msg = { role: 'user' | 'assistant'; content: string; isError?: boolean };

const CHAT_TIMEOUT_MS = 45000;

const forModel = (list: Msg[]) => list.filter((m) => !m.isError).map((m) => ({ role: m.role, content: m.content }));

function fbStyle(note: string) {
  if (note.startsWith('✅')) return { bg: C.successBg, border: '#86efac', text: '#166534' };
  if (note.startsWith('❌')) return { bg: C.dangerBg, border: '#fca5a5', text: '#991b1b' };
  if (note.startsWith('⚠️')) return { bg: C.warnBg, border: '#fcd34d', text: '#92400e' };
  return { bg: C.light, border: '#93c5fd', text: '#1e3a8a' };
}

export default function PatientScreen() {
  const { record } = useProgress();
  const pro = useProContent();
  const router = useRouter();
  // Без Pro разговор открыт только с бесплатными пациентами (ядро проверяет то же)
  const isLocked = (id: string) => authEnabled && !pro.isPro && !FREE_PATIENT_IDS.includes(id);
  const headerTop = useHeaderTopPadding();
  const online = useOnline();
  const [pat, setPat] = useState<typeof PATIENTS[0] | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fb, setFb] = useState('');
  const [fbLog, setFbLog] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [gainedXp, setGainedXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const ref = useRef<ScrollView>(null);

  const select = (p: typeof PATIENTS[0]) => {
    setPat(p); setMsgs([{ role: 'assistant', content: p.complaint }]); setFb(''); setFbLog([]); setFinished(false); setInput('');
  };

  const finish = () => {
    setFinished(true);
    setGainedXp(40);
    setStreak(record('patient', pat?.id ?? null, 40).streak);
  };

  const send = async () => {
    if (!input.trim() || !pat || loading) return;
    const txt = input.trim(); setInput('');
    const next: Msg[] = [...msgs.filter((m) => !m.isError), { role: 'user', content: txt }];
    setMsgs(next);
    const l = txt.toLowerCase();
    let note = '';
    if (l.includes('понима') || l.includes('слышу')) note = '✅ Эмпатия установлена — пациент чувствует, что его слышат.';
    else if (l.includes('поднимите руку') || l.includes('остановлюсь')) note = '✅ Стоп-сигнал даёт пациенту контроль — снижает страх.';
    else if (l.includes('анестез')) note = '✅ Ранняя информация об анестезии снижает тревогу.';
    else if (l.includes('не бойтесь')) note = '⚠️ «Не бойтесь» не убирает страх. Лучше: «Вы в надёжных руках».';
    else if (l.includes('больно не будет')) note = '❌ Нельзя гарантировать. Лучше: «Сделаем максимально комфортно».';
    else note = '💡 Используйте эмпатию, конкретику и стоп-сигнал.';
    setFb(note);
    setFbLog(prevLog => (prevLog.includes(note) ? prevLog : [...prevLog, note]));
    ask(next);
  };

  const ask = async (history: Msg[]) => {
    if (!pat) return;
    setLoading(true);
    try {
      const d = await aiPost<{ answer?: string }>('/api/patient/chat', { patientId: pat.id, messages: forModel(history) }, CHAT_TIMEOUT_MS);
      setMsgs([...history, { role: 'assistant', content: d.answer || '...' }]);
    } catch (e) {
      setMsgs([...history, { role: 'assistant', isError: true, content: errorText(e, 'ИИ-Пациент') }]);
    } finally {
      setLoading(false);
      setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  /** Повторить последнюю реплику врача после ошибки. */
  const retry = () => {
    if (loading) return;
    const history = msgs.filter((m) => !m.isError);
    if (history[history.length - 1]?.role !== 'user') return;
    setMsgs(history);
    ask(history);
  };

  const t = useScreenTransition(!pat ? 'list' : finished ? 'result' : `chat-${pat.id}`, !pat ? 0 : finished ? 2 : 1);

  if (!pat) return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}><Text style={s.title}>🤖 ИИ-Пациент</Text><Text style={s.sub}>Выберите психотип</Text></View>
      <ScrollView contentContainerStyle={s.grid}>
        {PATIENTS.map(p => (
          <TouchableOpacity key={p.id} style={[s.pc, isLocked(p.id) && { opacity: 0.75 }]}
            onPress={() => (isLocked(p.id) ? onLockedPress(pro, () => router.push('/profile'), 'patient') : select(p))} activeOpacity={0.7}>
            {isLocked(p.id) && <View style={{ position: 'absolute', top: 10, right: 10 }}><ProBadge /></View>}
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

  if (finished) {
    const good = fbLog.filter(f => f.startsWith('✅')).length;
    const total = fbLog.length || 1;
    const ratio = good / total;
    const grade =
      ratio >= 0.7
        ? { emoji: '🎉', title: 'Отличный приём!', color: C.success }
        : ratio >= 0.4
        ? { emoji: '💪', title: 'Неплохо! Есть куда расти', color: C.warn }
        : { emoji: '🌱', title: 'Первый блин комом — это нормально', color: C.danger };

    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop, backgroundColor: grade.color }]}>
          <Text style={s.title}>Приём завершён</Text>
          <Text style={s.sub}>{pat.avatar} {pat.name}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={[s.gradeCard, { borderColor: grade.color }]}>
            <Text style={s.gradeEmoji}>{grade.emoji}</Text>
            <Text style={[s.gradeTitle, { color: grade.color }]}>{grade.title}</Text>
            <Text style={s.gradeScore}>{good}/{total} удачных моментов</Text>
            <View style={s.rewardsRow}>
              <View style={s.rewardChip}>
                <Text style={s.rewardChipT}>⚡ +{gainedXp} XP</Text>
              </View>
              {streak > 1 && (
                <View style={[s.rewardChip, { backgroundColor: '#fff7ed' }]}>
                  <Text style={[s.rewardChipT, { color: '#c2410c' }]}>🔥 {streak} дней подряд</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={s.debriefTitle}>Разбор приёма</Text>
          {fbLog.length === 0 ? (
            <Text style={s.debriefEmpty}>Пациент не дал явной обратной связи — попробуйте больше говорить с эмпатией, обозначать стоп-сигнал и объяснять анестезию.</Text>
          ) : fbLog.map((f, i) => {
            const st = fbStyle(f);
            return (
              <View key={i} style={[s.debriefItem, { backgroundColor: st.bg, borderColor: st.border }]}>
                <Text style={[s.debriefText, { color: st.text }]}>{f}</Text>
              </View>
            );
          })}
          <TouchableOpacity style={s.finishBtn} onPress={() => setPat(null)}>
            <Text style={s.finishBtnT}>🔄 Другой пациент</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return t(
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <TouchableOpacity onPress={() => setPat(null)} style={s.back}><Text style={s.backT}>← Назад</Text></TouchableOpacity>
        <Text style={s.title}>{pat.avatar} {pat.name}</Text>
      </View>
      <View style={s.traitsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {pat.traits.map((t, i) => <View key={i} style={s.chip}><Text style={s.chipT}>{t}</Text></View>)}
        </ScrollView>
      </View>
      <TouchableOpacity style={s.endBar} onPress={finish} activeOpacity={0.85}>
        <Text style={s.endBarT}>✅  ЗАВЕРШИТЬ ПРИЁМ И ПОЛУЧИТЬ РАЗБОР</Text>
      </TouchableOpacity>
      <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
        {!online && (
          <View style={s.errBox}>
            <Text style={s.errT}>Нет подключения к интернету — пациент ответит, когда связь вернётся.</Text>
          </View>
        )}
        {msgs.map((m, i) => m.isError ? (
          <View key={i} style={s.errBox}>
            <Text selectable style={s.errT}>{m.content}</Text>
            {i === msgs.length - 1 && !loading && (
              <TouchableOpacity style={s.retryBtn} onPress={retry}>
                <Text style={s.retryBtnT}>Повторить</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View key={i} style={[s.mw, m.role === 'user' ? s.mr : s.ml]}>
            <Text style={s.mn}>{m.role === 'user' ? '👨‍⚕️ Врач' : pat.avatar}</Text>
            <View style={[s.bub, m.role === 'user' ? s.bDoc : s.bPat]}>
              <Text selectable style={[s.bubT, m.role === 'user' && s.bubTDoc]}>{m.content}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={[s.mw, s.ml]}>
            <Text style={s.mn}>{pat.avatar}</Text>
            <View style={[s.bub, s.bPat]}><TypingDots /></View>
          </View>
        )}
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
  hdr: { backgroundColor: C.dark, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  back: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 12 },
  endBar: { backgroundColor: C.success, paddingVertical: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  endBarT: { color: C.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
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
  errBox: { alignSelf: 'stretch', backgroundColor: '#FDECEC', borderRadius: 12, padding: 12, marginBottom: 10, gap: 8 },
  errT: { fontSize: 13, lineHeight: 18, color: '#A32D2D' },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  retryBtnT: { color: C.white, fontSize: 13, fontWeight: '700' },
  fb: { backgroundColor: C.successBg, borderTopWidth: 1, borderTopColor: '#86efac', padding: 12 },
  fbT: { fontSize: 12, color: '#166534', lineHeight: 17 },
  qr: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: C.white },
  qrb: { backgroundColor: C.light, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  qrT: { fontSize: 11, color: C.primary, fontWeight: '600' },
  inp: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  ti: { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 16, color: C.text, maxHeight: 80 },
  sb: { backgroundColor: C.primary, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sbT: { color: C.white, fontSize: 20, fontWeight: '700' },
  gradeCard: { backgroundColor: C.white, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20, borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.08, elevation: 3 },
  gradeEmoji: { fontSize: 52, marginBottom: 8 },
  gradeTitle: { fontSize: 19, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  gradeScore: { fontSize: 14, color: C.text2, marginBottom: 14 },
  rewardsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  rewardChip: { backgroundColor: C.successBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  rewardChipT: { fontSize: 13, fontWeight: '800', color: C.success },
  debriefTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 10 },
  debriefEmpty: { fontSize: 13, color: C.muted, lineHeight: 19 },
  debriefItem: { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  debriefText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  finishBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  finishBtnT: { color: C.white, fontSize: 14, fontWeight: '700' },
});