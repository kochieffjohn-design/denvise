import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { useScreenTransition } from '../../components/ScreenTransition';
import { C } from '../../constants/Colors';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { PROCEDURE_SPECIALTIES, PROCEDURES } from '../../data/clinicalData';
import { useRouter } from 'expo-router';
import { ProBadge } from '../../components/ProBadge';
import { PRO_PROCEDURES } from '../../data/proCatalog';
import { onLockedPress, useProContent } from '../../lib/content';

type Proc = typeof PROCEDURES[0];

const ICONS: Record<string, { lib: 'ion' | 'mci'; name: string; bg: string; color: string; tag: string }> = {
  'Профессиональная гигиена': { lib: 'mci', name: 'tooth-outline', bg: '#E1F5EE', color: '#0F6E56', tag: 'Гигиена' },
  'Отбеливание зубов':        { lib: 'ion', name: 'sparkles-outline', bg: '#FAEEDA', color: '#854F0B', tag: 'Эстетика' },
  'Реставрация фронтальных зубов': { lib: 'ion', name: 'brush-outline', bg: '#FBEAF0', color: '#993556', tag: 'Эстетика' },
  'Лечение кариеса':          { lib: 'mci', name: 'tooth', bg: '#E6F1FB', color: '#185FA5', tag: 'Терапия' },
  'Лечение пульпита':         { lib: 'mci', name: 'needle', bg: '#EEEDFE', color: '#534AB7', tag: 'Терапия' },
  'Лечение периодонтита':     { lib: 'ion', name: 'cellular-outline', bg: '#EAF3DE', color: '#3B6D11', tag: 'Терапия' },
  'Удаление зуба':            { lib: 'mci', name: 'pliers', bg: '#FAECE7', color: '#993C1D', tag: 'Хирургия' },
  'Дентальная имплантация':   { lib: 'mci', name: 'screw-flat-top', bg: '#FCF0E8', color: '#7A3B10', tag: 'Хирургия' },
  'Синуслифтинг':             { lib: 'ion', name: 'medical-outline', bg: '#FFF0E6', color: '#854F0B', tag: 'Хирургия' },
  'Пластика мягких тканей (рецессия)': { lib: 'ion', name: 'fitness-outline', bg: '#F5EAF9', color: '#7B3FA0', tag: 'Хирургия' },
  'Виниры':                   { lib: 'ion', name: 'diamond-outline', bg: '#E6F4FB', color: '#0C6E9E', tag: 'Ортопедия' },
  'Искусственные коронки':    { lib: 'ion', name: 'shield-checkmark-outline', bg: '#E8F5E9', color: '#2E7D32', tag: 'Ортопедия' },
  'Съёмное протезирование':   { lib: 'ion', name: 'grid-outline', bg: '#F3F0FB', color: '#4527A0', tag: 'Ортопедия' },
  'Брекет-система':           { lib: 'mci', name: 'dots-horizontal', bg: '#FFF8E1', color: '#F57F17', tag: 'Ортодонтия' },
  'Элайнеры':                 { lib: 'ion', name: 'today-outline', bg: '#E0F7FA', color: '#00695C', tag: 'Ортодонтия' },
  'Съёмные пластинки':        { lib: 'ion', name: 'ellipse-outline', bg: '#FCE4EC', color: '#880E4F', tag: 'Ортодонтия' },
  'Мини-винты (ТАД)':         { lib: 'mci', name: 'screw-flat-top', bg: '#ECEFF1', color: '#37474F', tag: 'Ортодонтия' },
  'Пластика уздечки':         { lib: 'ion', name: 'cut-outline', bg: '#F1F8E9', color: '#33691E', tag: 'Ортодонтия' },
  'Ретейнеры':                { lib: 'ion', name: 'lock-closed-outline', bg: '#E8EAF6', color: '#283593', tag: 'Ортодонтия' },
};

const TAGS = ['Все', ...PROCEDURE_SPECIALTIES];

const TAG_COLORS: Record<string, string> = {
  'Гигиена': '#0F6E56', 'Эстетика': '#993556', 'Терапия': '#185FA5',
  'Хирургия': '#993C1D', 'Ортопедия': '#2E7D32', 'Ортодонтия': '#F57F17',
};

function ProcIcon({ name }: { name: string }) {
  const ic = ICONS[name];
  if (!ic) return <View style={[s.iconWrap, { backgroundColor: '#F0F0F0' }]} />;
  return (
    <View style={[s.iconWrap, { backgroundColor: ic.bg }]}>
      {ic.lib === 'ion'
        ? <Ionicons name={ic.name as any} size={26} color={ic.color} />
        : <MaterialCommunityIcons name={ic.name as any} size={26} color={ic.color} />}
    </View>
  );
}

export default function ReceptionScreen() {
  const pro = useProContent();
  const router = useRouter();
  const procedures: Proc[] = [...PROCEDURES, ...((pro.content?.procedures ?? []) as Proc[])];
  const lockedAll = pro.content ? [] : PRO_PROCEDURES;
  const headerTop = useHeaderTopPadding();
  const [activeTag, setActiveTag] = useState('Все');
  const [active, setActive] = useState<Proc | null>(null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<'steps' | 'tools'>('steps');

  const byTag = (p: { name: string }) => activeTag === 'Все' || ICONS[p.name]?.tag === activeTag;
  const locked = lockedAll.filter(byTag);
  const filtered = procedures.filter(p => {
    const ic = ICONS[p.name];
    return activeTag === 'Все' || ic?.tag === activeTag;
  });

  const t = useScreenTransition(active ? `proc-${active.name}` : 'list', active ? 1 : 0);

  if (active) {
    const ic = ICONS[active.name];
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={() => { setActive(null); setStep(0); setTab('steps'); }} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={C.white} />
            <Text style={s.backT}>Назад</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {ic && (
            <View style={[s.hdrIcon, { backgroundColor: ic.bg }]}>
              {ic.lib === 'ion'
                ? <Ionicons name={ic.name as any} size={20} color={ic.color} />
                : <MaterialCommunityIcons name={ic.name as any} size={20} color={ic.color} />}
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.procHeader}>
            <View style={[s.tagBadge, { backgroundColor: (ic ? ic.bg : '#eee') }]}>
              <Text style={[s.tagBadgeT, { color: ic?.color || C.muted }]}>{ic?.tag}</Text>
            </View>
            <Text style={s.procTitle}>{active.name}</Text>
            <Text style={s.procAbout}>{active.about}</Text>
          </View>

          <View style={s.tabRow}>
            <TouchableOpacity style={[s.tab, tab === 'steps' && s.tabActive]} onPress={() => setTab('steps')}>
              <Text style={[s.tabT, tab === 'steps' && s.tabTActive]}>Протокол</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tab, tab === 'tools' && s.tabActive]} onPress={() => setTab('tools')}>
              <Text style={[s.tabT, tab === 'tools' && s.tabTActive]}>Оснащение</Text>
            </TouchableOpacity>
          </View>

          {tab === 'steps' && (
            <View style={s.stepsWrap}>
              {active.steps.map((st, i) => (
                <TouchableOpacity key={i} style={[s.stepCard, step === i && s.stepCardActive]}
                  onPress={() => setStep(step === i ? -1 : i)} activeOpacity={0.7}>
                  <View style={s.stepTop}>
                    <View style={[s.stepNum, { backgroundColor: ic?.bg || '#eee' }]}>
                      <Text style={[s.stepNumT, { color: ic?.color || C.muted }]}>{i + 1}</Text>
                    </View>
                    <Text style={s.stepTitle}>{st.t}</Text>
                    <Ionicons name={step === i ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
                  </View>
                  {step === i && (
                    <View style={s.stepBody}>
                      <Text style={s.stepD}>{st.d}</Text>
                      {st.c && (
                        <View style={[s.stepNote, { borderLeftColor: ic?.color || C.primary }]}>
                          <Text style={s.stepNoteT}>{st.c}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {tab === 'tools' && (
            <View style={s.toolsWrap}>
              {active.tools.map((tool, i) => (
                <View key={i} style={s.toolRow}>
                  <View style={[s.toolDot, { backgroundColor: ic?.color || C.primary }]} />
                  <Text style={s.toolT}>{tool}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrTitle}>Приём у доктора</Text>
        <Text style={s.hdrSub}>{PROCEDURES.length + PRO_PROCEDURES.length} протоколов</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tagsRow} style={s.tagsScroll}>
          {TAGS.map(t => (
            <TouchableOpacity key={t} style={[s.tagBtn, activeTag === t && { backgroundColor: (TAG_COLORS[t] || C.primary) }]}
              onPress={() => setActiveTag(t)} activeOpacity={0.7}>
              <Text style={[s.tagBtnT, activeTag === t && { color: C.white }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.grid}>
          {filtered.map(p => {
            const ic = ICONS[p.name];
            return (
              <TouchableOpacity key={p.name} style={s.card} onPress={() => setActive(p)} activeOpacity={0.75}>
                <ProcIcon name={p.name} />
                <Text style={s.cardName} numberOfLines={2}>{p.name}</Text>
                {ic && (
                  <View style={[s.cardTag, { backgroundColor: ic.bg }]}>
                    <Text style={[s.cardTagT, { color: ic.color }]}>{ic.tag}</Text>
                  </View>
                )}
                <View style={s.stepsCount}>
                  <Ionicons name="list-outline" size={12} color={C.muted} />
                  <Text style={s.stepsCountT}>{p.steps.length} шагов</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {locked.map(p => {
            const ic = ICONS[p.name];
            return (
              <TouchableOpacity key={p.name} style={[s.card, { opacity: 0.75 }]} onPress={() => onLockedPress(pro, () => router.push('/profile'), 'reception')} activeOpacity={0.75}>
                <ProcIcon name={p.name} />
                <Text style={s.cardName} numberOfLines={2}>{p.name}</Text>
                {ic && (
                  <View style={[s.cardTag, { backgroundColor: ic.bg }]}>
                    <Text style={[s.cardTagT, { color: ic.color }]}>{ic.tag}</Text>
                  </View>
                )}
                <ProBadge />
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  hdr: {
    backgroundColor: C.dark,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hdrTitle: { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  hdrSub: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginLeft: 8, marginTop: 3 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 13, fontWeight: '500' },
  hdrIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagsScroll: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tagsRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  tagBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  tagBtnT: { fontSize: 13, fontWeight: '500', color: C.text2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    width: '47.5%',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 18 },
  cardTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardTagT: { fontSize: 10, fontWeight: '700' },
  stepsCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepsCountT: { fontSize: 11, color: C.muted },
  procHeader: { padding: 18, gap: 8 },
  tagBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagBadgeT: { fontSize: 12, fontWeight: '700' },
  procTitle: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5, lineHeight: 30 },
  procAbout: { fontSize: 14, color: C.text2, lineHeight: 21 },
  tabRow: { flexDirection: 'row', marginHorizontal: 14, backgroundColor: C.light, borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabT: { fontSize: 13, color: C.muted, fontWeight: '500' },
  tabTActive: { color: C.text, fontWeight: '700' },
  stepsWrap: { padding: 14, gap: 8 },
  stepCard: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  stepCardActive: { borderColor: C.primary },
  stepTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumT: { fontSize: 13, fontWeight: '800' },
  stepTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: C.text, lineHeight: 18 },
  stepBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  stepD: { fontSize: 13, color: C.text2, lineHeight: 20 },
  stepNote: { borderLeftWidth: 3, paddingLeft: 10, borderRadius: 4 },
  stepNoteT: { fontSize: 12, color: C.text2, lineHeight: 18, fontStyle: 'italic' },
  toolsWrap: { padding: 14, gap: 6 },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  toolDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  toolT: { fontSize: 13, color: C.text2, flex: 1 },
});