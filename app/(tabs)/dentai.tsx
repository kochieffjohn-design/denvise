import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TouchableOpacity } from '../../components/Touchable';
import { C } from '../../constants/Colors';
import { useOnline } from '../../hooks/useOnline';
import { useHeaderTopPadding } from '../../hooks/useSafeLayout';
import { DENTAI_API_URL } from '../../constants/config';
import { errorText, postJson } from '../../lib/api';

type VerifiedSource = { number: number; source: string; title: string };
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  sources?: VerifiedSource[];
  flagged?: boolean;
};

// Ответ ДентИИ занимает до ~30 с (большой промпт), даём запас.
const ASK_TIMEOUT_MS = 60000;

type AskResponse = { answer?: string; sources?: VerifiedSource[]; flagged?: boolean };

/** История для модели: без плашек с ошибками — это не реплики ДентИИ. */
const forModel = (list: Msg[]) => list.filter((m) => !m.isError).map((m) => ({ role: m.role, content: m.content }));

const SUGGESTED_QUESTIONS = [
  'Дифдиагностика кариеса дентина и острого пульпита?',
  'Протокол лечения острого периодонтита',
  'Как объяснить пациенту, зачем нужна профгигиена?',
  'Что делать при возражении «дорого» на импланты?',
];

export default function DentAIScreen() {
  const headerTop = useHeaderTopPadding();
  const online = useOnline();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Кэш сырых текстов источников (см. GET /api/dentai/source/:number) — чтобы
  // при повторном открытии того же источника не дёргать сервер заново.
  const [sourceTexts, setSourceTexts] = useState<Record<number, string>>({});
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [loadingSource, setLoadingSource] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const ask = async (history: Msg[]) => {
    setLoading(true);
    scrollToEnd();
    try {
      const data = await postJson<AskResponse>(`${DENTAI_API_URL}/api/dentai/ask`, { messages: forModel(history) }, ASK_TIMEOUT_MS);
      setMsgs([
        ...history,
        { role: 'assistant', content: data.answer || '(пустой ответ)', sources: data.sources || [], flagged: !!data.flagged },
      ]);
    } catch (e) {
      setMsgs([...history, { role: 'assistant', isError: true, content: errorText(e, 'ДентИИ') }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  };

  const send = (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...msgs.filter((m) => !m.isError), { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    ask(next);
  };

  /** Повторить последний вопрос после ошибки. */
  const retry = () => {
    if (loading) return;
    const history = msgs.filter((m) => !m.isError);
    if (history[history.length - 1]?.role !== 'user') return;
    setMsgs(history);
    ask(history);
  };

  const resetChat = () => {
    setMsgs([]);
    setExpandedSources(new Set());
  };

  const toggleSource = async (number: number) => {
    const isOpen = expandedSources.has(number);
    const nextSet = new Set(expandedSources);
    if (isOpen) {
      nextSet.delete(number);
      setExpandedSources(nextSet);
      return;
    }
    nextSet.add(number);
    setExpandedSources(nextSet);

    if (sourceTexts[number]) return; // уже загружено раньше

    setLoadingSource(number);
    try {
      const res = await fetch(`${DENTAI_API_URL}/api/dentai/source/${number}`);
      const data = await res.json();
      if (res.ok) {
        setSourceTexts((prev) => ({ ...prev, [number]: data.text }));
      } else {
        setSourceTexts((prev) => ({ ...prev, [number]: `Не удалось загрузить источник: ${data?.error ?? ''}` }));
      }
    } catch {
      setSourceTexts((prev) => ({ ...prev, [number]: 'Не удалось загрузить источник (нет связи с сервером).' }));
    } finally {
      setLoadingSource(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={[s.header, { paddingTop: headerTop }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>🧠 ДентИИ</Text>
          <Text style={s.subtitle}>Только по базе знаний Denvise</Text>
        </View>
        {msgs.length > 0 && (
          <TouchableOpacity onPress={resetChat} style={s.resetBtn}>
            <Text style={s.resetBtnText}>Новый чат</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>
          Вспомогательный инструмент, не замена клиническому суждению. Финальное решение — за врачом.
        </Text>
      </View>

      {!online && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineBannerText}>Нет подключения к интернету — ДентИИ ответит, когда связь вернётся.</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {msgs.length === 0 && (
          <View style={s.introCard}>
            <Text style={s.introTitle}>Спросите про протокол, диагностику или разговор с пациентом</Text>
            <Text style={s.introSub}>
              Ответы — только по протоколам, клиническим случаям и скриптам Denvise. Если в базе
              нет ответа, ДентИИ так и скажет — не станет придумывать. Под каждым ответом — реальные
              источники, на которые он опирается, их можно открыть и проверить самому.
            </Text>
            <View style={{ gap: 8, marginTop: 14 }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={s.suggestChip} onPress={() => send(q)}>
                  <Text style={s.suggestChipText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {msgs.map((m, i) => {
          if (m.role === 'user') {
            return (
              <View key={i} style={s.userBubbleWrap}>
                <View style={s.userBubble}>
                  <Text selectable style={s.userBubbleText}>{m.content}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={i} style={s.assistantBubbleWrap}>
              <View style={[s.assistantBubble, m.isError && s.assistantBubbleError]}>
                <Text selectable style={[s.assistantBubbleText, m.isError && s.assistantBubbleErrorText]}>
                  {m.content}
                </Text>

                {m.isError && i === msgs.length - 1 && !loading && (
                  <TouchableOpacity style={s.retryBtn} onPress={retry}>
                    <Text style={s.retryBtnText}>Повторить</Text>
                  </TouchableOpacity>
                )}

                {m.flagged && !m.isError && (
                  <View style={s.flagBanner}>
                    <Text style={s.flagBannerText}>
                      ⚠️ Модель сослалась на источник, которого нет в базе, либо не указала источники вообще.
                      Проверьте ответ особенно внимательно.
                    </Text>
                  </View>
                )}

                {!!m.sources?.length && (
                  <View style={s.sourcesWrap}>
                    <Text style={s.sourcesLabel}>Источники:</Text>
                    <View style={{ gap: 6 }}>
                      {m.sources.map((src) => {
                        const isOpen = expandedSources.has(src.number);
                        return (
                          <View key={src.number}>
                            <TouchableOpacity style={s.sourceChip} onPress={() => toggleSource(src.number)}>
                              <Text style={s.sourceChipText}>
                                #{src.number} {src.title} {isOpen ? '▲' : '▼'}
                              </Text>
                            </TouchableOpacity>
                            {isOpen && (
                              <View style={s.sourceText}>
                                {loadingSource === src.number ? (
                                  <ActivityIndicator size="small" color={C.primary} />
                                ) : (
                                  <Text selectable style={s.sourceTextContent}>{sourceTexts[src.number]}</Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={s.assistantBubbleWrap}>
            <View style={[s.assistantBubble, s.loadingBubble]}>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={s.loadingText}>Ищу в базе Denvise…</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Например: доза артикаина детям"
          placeholderTextColor={C.muted}
          multiline
          editable={!loading}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send()}
          disabled={!input.trim() || loading}
        >
          <Text style={s.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.dark,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { color: C.white, fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  offlineBanner: { backgroundColor: '#FDECEC', paddingVertical: 8, paddingHorizontal: 16 },
  offlineBannerText: { color: '#A32D2D', fontSize: 12, textAlign: 'center', lineHeight: 17 },
  retryBtn: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  retryBtnText: { color: C.white, fontSize: 13, fontWeight: '700' },
  resetBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetBtnText: { color: C.white, fontSize: 12, fontWeight: '700' },

  disclaimer: {
    backgroundColor: C.warnBg,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  disclaimerText: { color: '#92600a', fontSize: 11, lineHeight: 15, textAlign: 'center' },

  scroll: { padding: 16, paddingBottom: 24, gap: 10 },

  introCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    elevation: 2,
  },
  introTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 },
  introSub: { fontSize: 13, color: C.muted, lineHeight: 19 },
  suggestChip: {
    backgroundColor: C.light,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestChipText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  userBubbleWrap: { alignItems: 'flex-end' },
  userBubble: {
    backgroundColor: C.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  userBubbleText: { color: C.white, fontSize: 14, lineHeight: 20 },

  assistantBubbleWrap: { alignItems: 'flex-start' },
  assistantBubble: {
    backgroundColor: C.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: C.border,
  },
  assistantBubbleError: { backgroundColor: C.dangerBg, borderColor: C.danger },
  assistantBubbleText: { color: C.text, fontSize: 14, lineHeight: 20 },
  assistantBubbleErrorText: { color: C.danger },

  flagBanner: {
    backgroundColor: C.warnBg,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  flagBannerText: { color: '#92600a', fontSize: 11, lineHeight: 15 },

  sourcesWrap: { marginTop: 10, gap: 6 },
  sourcesLabel: { color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sourceChip: {
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  sourceChipText: { color: C.primary, fontSize: 12, fontWeight: '600' },
  sourceText: {
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  sourceTextContent: { color: C.text2, fontSize: 12, lineHeight: 18 },

  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: C.muted, fontSize: 13 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  input: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  sendBtn: {
    backgroundColor: C.primary,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: C.white, fontSize: 18, fontWeight: '700' },
});
