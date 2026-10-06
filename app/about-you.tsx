import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from '../components/Touchable';
import { C } from '../constants/Colors';
import { ROLE_LABELS, UNIVERSITIES } from '../data/universities';
import { useHeaderTopPadding, useScreenBottomPadding } from '../hooks/useSafeLayout';
import { useSession, type Profile } from '../lib/session';

// «Расскажите о себе»: один раз после первого входа (без профиля приложение
// дальше не пускает, см. app/_layout.tsx) и потом — «Изменить» в Профиле.

type Role = Profile['role'];
const ROLES = Object.keys(ROLE_LABELS) as Role[];
const WITH_UNIVERSITY: Role[] = ['student', 'graduate', 'resident'];

export default function AboutYouScreen() {
  const headerTop = useHeaderTopPadding();
  const bottomPad = useScreenBottomPadding();
  const router = useRouter();
  const { user, saveProfile } = useSession();
  const editing = !!user?.profile; // профиль уже есть — значит, пришли из Профиля
  const p = user?.profile;

  const [firstName, setFirstName] = useState(p?.firstName ?? '');
  const [lastName, setLastName] = useState(p?.lastName ?? '');
  const [role, setRole] = useState<Role | null>(p?.role ?? null);
  const [course, setCourse] = useState<number | null>(p?.course ?? null);
  const [university, setUniversity] = useState(p?.university ?? '');
  const [uniFocused, setUniFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const needUni = !!role && WITH_UNIVERSITY.includes(role);
  const ready = !!firstName.trim() && !!role && (role !== 'student' || !!course) && (!needUni || !!university.trim());

  // Подсказки вузов: по любому слову из ввода
  const suggestions = useMemo(() => {
    const q = university.trim().toLowerCase();
    if (!q) return UNIVERSITIES.slice(0, 6).map((u) => u.name);
    if (UNIVERSITIES.some((u) => u.name.toLowerCase() === q)) return [];
    const words = q.split(/\s+/);
    // Ищем и по названию, и по сокращениям / старым названиям (СОГМА, МГМСУ…)
    return UNIVERSITIES.filter((u) => {
      const hay = `${u.name} ${u.search}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
      .slice(0, 6)
      .map((u) => u.name);
  }, [university]);

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await saveProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        role: role!,
        course: role === 'student' ? course : null,
        university: needUni ? university.trim() : null,
      });
      if (editing && router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить. Проверьте интернет и попробуйте снова.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: headerTop + 24, paddingBottom: bottomPad + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {editing && (
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Text style={s.backT}>← Назад</Text>
          </TouchableOpacity>
        )}
        <Text style={s.title}>{editing ? 'О себе' : 'Расскажите о себе'}</Text>
        {!editing && <Text style={s.subtitle}>Так мы подберём задания и поймём, кому Denvise помогает больше всего.</Text>}

        <Text style={s.label}>Имя</Text>
        <TextInput style={s.input} value={firstName} onChangeText={setFirstName} placeholder="Иван" placeholderTextColor="rgba(255,255,255,0.35)" autoComplete="given-name" textContentType="givenName" maxLength={40} />

        <Text style={s.label}>Фамилия <Text style={s.optional}>— необязательно</Text></Text>
        <TextInput style={s.input} value={lastName} onChangeText={setLastName} placeholder="Петров" placeholderTextColor="rgba(255,255,255,0.35)" autoComplete="family-name" textContentType="familyName" maxLength={60} />

        <Text style={s.label}>Кто вы</Text>
        <View style={s.chips}>
          {ROLES.map((r) => (
            <TouchableOpacity key={r} style={[s.chip, role === r && s.chipOn]} onPress={() => setRole(r)}>
              <Text style={[s.chipT, role === r && s.chipTOn]}>{ROLE_LABELS[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {role === 'student' && (
          <>
            <Text style={s.label}>Курс</Text>
            <View style={s.chips}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} style={[s.chip, s.courseChip, course === n && s.chipOn]} onPress={() => setCourse(n)}>
                  <Text style={[s.chipT, course === n && s.chipTOn]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {needUni && (
          <>
            <Text style={s.label}>Вуз</Text>
            <TextInput
              style={s.input}
              value={university}
              onChangeText={setUniversity}
              onFocus={() => setUniFocused(true)}
              onBlur={() => setTimeout(() => setUniFocused(false), 150)}
              placeholder="Начните вводить: РУМ, Казань…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              maxLength={120}
            />
            {uniFocused && suggestions.length > 0 && (
              <View style={s.suggest}>
                {suggestions.map((u) => (
                  <TouchableOpacity key={u} style={s.suggestRow} onPress={() => { setUniversity(u); setUniFocused(false); }}>
                    <Text style={s.suggestT}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {!!error && <Text style={s.error}>{error}</Text>}

        <TouchableOpacity style={[s.btn, (!ready || busy) && s.btnDisabled]} onPress={save} disabled={!ready || busy}>
          <Text style={s.btnText}>{busy ? 'Сохраняем…' : editing ? 'Сохранить' : 'Продолжить'}</Text>
        </TouchableOpacity>
        <Text style={s.note}>Эти данные видите только вы. Без вашего согласия мы их никому не показываем.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.dark },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 10 },
  back: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
  backT: { color: '#93C5FD', fontSize: 15, fontWeight: '600' },
  title: { color: C.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22, marginBottom: 6 },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600', marginTop: 8 },
  optional: { color: 'rgba(255,255,255,0.4)', fontWeight: '400' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: C.white,
    fontSize: 17,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 10 },
  courseChip: { minWidth: 48, alignItems: 'center' },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipT: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  chipTOn: { color: C.white, fontWeight: '700' },
  suggest: { borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  suggestRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggestT: { color: C.white, fontSize: 15 },
  error: { color: '#FCA5A5', fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  note: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
