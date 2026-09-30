import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { useScreenTransition } from '../../components/ScreenTransition';
import { C } from '../../constants/Colors';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { CONSULT_SECTIONS, GLOSSARY, type Script, type Section } from '../../data/clinicalData';

export default function ConsultScreen() {
  const headerTop = useHeaderTopPadding();
  const [tab, setTab] = useState<'scripts' | 'glossary'>('scripts');
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [activeScript, setActiveScript] = useState<Script | null>(null);
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredGlossary = useMemo(() =>
    GLOSSARY.filter(g =>
      g.term.toLowerCase().includes(search.toLowerCase()) ||
      g.simple.toLowerCase().includes(search.toLowerCase())
    ), [search]);

  const t = useScreenTransition(activeScript ? `script-${activeScript.title}` : activeSection ? `section-${activeSection.title}` : `list-${tab}`, activeScript ? 2 : activeSection ? 1 : 0);

  if (activeScript) {
    const sec = CONSULT_SECTIONS.find(s => s.scripts.find(sc => sc.id === activeScript.id));
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop }]}>
          <TouchableOpacity onPress={() => setActiveScript(null)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={C.white} />
            <Text style={s.backT}>Назад</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.scriptHeader}>
            <View style={[s.scriptTag, { backgroundColor: sec?.bg }]}>
              <Text style={[s.scriptTagT, { color: sec?.color }]}>{sec?.title}</Text>
            </View>
            <Text style={s.scriptTitle}>{activeScript.title}</Text>
            <View style={[s.situationBox, { borderLeftColor: sec?.color }]}>
              <Text style={s.situationT}>{activeScript.situation}</Text>
            </View>
          </View>

          {/* Структура разговора */}
          <View style={s.block}>
            <Text style={s.blockTitle}>Структура разговора</Text>
            {activeScript.steps.map((st, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[s.stepBadge, { backgroundColor: sec?.bg }]}>
                  <Text style={[s.stepBadgeT, { color: sec?.color }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.stepLabel}>{st.label}</Text>
                  <Text style={s.stepText}>{st.text}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Возражения */}
          <View style={s.block}>
            <Text style={s.blockTitle}>Работа с возражениями</Text>
            {activeScript.objections.map((obj, i) => (
              <TouchableOpacity key={i} style={s.objCard}
                onPress={() => setOpenBlock(openBlock === `obj${i}` ? null : `obj${i}`)}
                activeOpacity={0.7}>
                <View style={s.objTop}>
                  <Text style={s.objQ}>«{obj.q}»</Text>
                  <Ionicons name={openBlock === `obj${i}` ? 'chevron-up' : 'chevron-down'} size={14} color={C.muted} />
                </View>
                {openBlock === `obj${i}` && (
                  <Text style={[s.objA, { borderLeftColor: sec?.color }]}>→ {obj.a}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Запретные */}
          <View style={s.block}>
            <Text style={s.blockTitle}>Никогда не говорить</Text>
            {activeScript.forbidden.map((f, i) => (
              <View key={i} style={s.forbidRow}>
                <View style={s.forbidDot} />
                <Text style={s.forbidT}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Золотые */}
          <View style={s.block}>
            <Text style={s.blockTitle}>Золотые фразы</Text>
            {activeScript.golden.map((g, i) => (
              <View key={i} style={[s.goldenRow, { borderLeftColor: sec?.color }]}>
                <Text style={s.goldenT}>{g}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (activeSection) {
    return t(
      <View style={s.container}>
        <View style={[s.hdr, { paddingTop: headerTop, backgroundColor: activeSection.color }]}>
          <TouchableOpacity onPress={() => setActiveSection(null)} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color={C.white} />
            <Text style={s.backT}>Назад</Text>
          </TouchableOpacity>
          <Text style={s.hdrTitle}>{activeSection.title}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          {activeSection.scripts.map(sc => (
            <TouchableOpacity key={sc.id} style={s.scriptCard}
              onPress={() => { setActiveScript(sc); setOpenBlock(null); }} activeOpacity={0.75}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.scriptCardTitle}>{sc.title}</Text>
                <Text style={s.scriptCardSit} numberOfLines={2}>{sc.situation}</Text>
              </View>
              <View style={s.scriptArrow}>
                <Ionicons name="chevron-forward" size={16} color={activeSection.color} />
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
    );
  }

  return t(
    <View style={s.container}>
      <View style={[s.hdr, { paddingTop: headerTop }]}>
        <Text style={s.hdrTitle}>Консультации</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'scripts' && s.tabActive]} onPress={() => setTab('scripts')}>
          <Text style={[s.tabT, tab === 'scripts' && s.tabTActive]}>Скрипты</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'glossary' && s.tabActive]} onPress={() => setTab('glossary')}>
          <Text style={[s.tabT, tab === 'glossary' && s.tabTActive]}>Словарь</Text>
        </TouchableOpacity>
      </View>

      {tab === 'scripts' && (
        <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          {CONSULT_SECTIONS.map(sec => (
            <TouchableOpacity key={sec.id} style={s.sectionCard}
              onPress={() => setActiveSection(sec)} activeOpacity={0.75}>
              <View style={[s.sectionIcon, { backgroundColor: sec.bg }]}>
                <Ionicons name={sec.icon as any} size={24} color={sec.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>{sec.title}</Text>
                <Text style={s.sectionSub}>{sec.scripts.length} скриптов</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {tab === 'glossary' && (
        <View style={{ flex: 1 }}>
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={C.muted} />
            <TextInput
              style={s.searchInput}
              placeholder="Поиск термина..."
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, gap: 8 }} showsVerticalScrollIndicator={false}>
            {filteredGlossary.map((g, i) => (
              <TouchableOpacity key={i} style={s.glossCard}
                onPress={() => setOpenBlock(openBlock === `g${i}` ? null : `g${i}`)}
                activeOpacity={0.7}>
                <View style={s.glossTop}>
                  <Text style={s.glossTerm}>{g.term}</Text>
                  <Text style={s.glossSimple} numberOfLines={openBlock === `g${i}` ? undefined : 1}>{g.simple}</Text>
                </View>
                {openBlock === `g${i}` && (
                  <View style={s.glossExpanded}>
                    <Text style={s.glossLabel}>Как объяснить пациенту:</Text>
                    <Text style={s.glossPatient}>«{g.forPatient}»</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      )}
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
    gap: 10,
  },
  hdrTitle: { color: C.white, fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  backT: { color: C.white, fontSize: 13, fontWeight: '500' },
  tabRow: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabT: { fontSize: 14, color: C.muted, fontWeight: '500' },
  tabTActive: { color: C.primary, fontWeight: '700' },
  sectionCard: {
    backgroundColor: C.white, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  sectionSub: { fontSize: 12, color: C.muted, marginTop: 2 },
  scriptCard: {
    backgroundColor: C.white, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, elevation: 1,
    borderWidth: 1, borderColor: C.border,
  },
  scriptCardTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  scriptCardSit: { fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 17 },
  scriptArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center' },
  scriptHeader: { padding: 18, gap: 10 },
  scriptTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  scriptTagT: { fontSize: 12, fontWeight: '700' },
  scriptTitle: { fontSize: 24, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  situationBox: { borderLeftWidth: 3, paddingLeft: 12, borderRadius: 4 },
  situationT: { fontSize: 13, color: C.text2, lineHeight: 20 },
  block: { marginHorizontal: 14, marginBottom: 14, gap: 8 },
  blockTitle: { fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  stepRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  stepBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepBadgeT: { fontSize: 12, fontWeight: '800' },
  stepLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  stepText: { fontSize: 13, color: C.text2, lineHeight: 19 },
  objCard: { backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  objTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  objQ: { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
  objA: { fontSize: 13, color: C.text2, marginTop: 10, borderLeftWidth: 3, paddingLeft: 10, lineHeight: 19 },
  forbidRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  forbidDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, flexShrink: 0 },
  forbidT: { fontSize: 13, color: C.danger, flex: 1 },
  goldenRow: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 8 },
  goldenT: { fontSize: 13, color: C.text2, lineHeight: 19, fontStyle: 'italic' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 14, backgroundColor: C.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 16, color: C.text },
  glossCard: { backgroundColor: C.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  glossTop: { gap: 3 },
  glossTerm: { fontSize: 15, fontWeight: '700', color: C.text },
  glossSimple: { fontSize: 13, color: C.muted },
  glossExpanded: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, gap: 4 },
  glossLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  glossPatient: { fontSize: 13, color: C.text2, lineHeight: 19 },
});