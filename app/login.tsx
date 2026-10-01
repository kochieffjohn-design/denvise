import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from '../components/Touchable';
import { C } from '../constants/Colors';
import { useHeaderTopPadding, useScreenBottomPadding } from '../hooks/useSafeLayout';
import { AuthError, useSession } from '../lib/session';

// Вход без пароля: почта → 6-значный код из письма → приложение.
// Первый вход создаёт аккаунт, отдельной регистрации нет.

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const headerTop = useHeaderTopPadding();
  const bottomPad = useScreenBottomPadding();
  const { requestCode, verifyCode } = useSession();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<TextInput>(null);

  // Обратный отсчёт до повторной отправки кода
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const emailOk = EMAIL_RE.test(email.trim());

  const sendCode = async () => {
    if (!emailOk || busy) return;
    setBusy(true);
    setError('');
    try {
      await requestCode(email);
      setStep('code');
      setCode('');
      setResendIn(RESEND_SECONDS);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Не удалось отправить код. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      await verifyCode(email, value);
      // Дальше корневой макет сам покажет приложение
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Не удалось войти. Попробуйте ещё раз.');
      setCode('');
      codeRef.current?.focus();
      setBusy(false);
    }
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError('');
    if (digits.length === 6) submitCode(digits); // как только введены все цифры
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: headerTop + 32, paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logo}>
          <Text style={s.logoText}>Den</Text>
          <Text style={[s.logoText, { color: C.accent }]}>vise</Text>
        </View>

        {step === 'email' ? (
          <>
            <Text style={s.title}>Вход</Text>
            <Text style={s.subtitle}>Без пароля — пришлём код на почту. Если аккаунта ещё нет, он создастся сам.</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError('');
              }}
              placeholder="Электронная почта"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              editable={!busy}
              autoFocus
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity style={[s.btn, (!emailOk || busy) && s.btnDisabled]} onPress={sendCode} disabled={!emailOk || busy}>
              {busy ? <ActivityIndicator color={C.white} /> : <Text style={s.btnText}>Получить код</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.title}>Код из письма</Text>
            <Text style={s.subtitle}>
              Отправили 6 цифр на <Text style={s.email}>{email.trim()}</Text>. Письмо может прийти через минуту — проверьте и «Спам».
            </Text>
            <TextInput
              ref={codeRef}
              style={[s.input, s.codeInput]}
              value={code}
              onChangeText={onCodeChange}
              placeholder="••••••"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              editable={!busy}
              autoFocus
            />
            {!!error && <Text style={s.error}>{error}</Text>}
            <TouchableOpacity style={[s.btn, (code.length !== 6 || busy) && s.btnDisabled]} onPress={() => submitCode(code)} disabled={code.length !== 6 || busy}>
              {busy ? <ActivityIndicator color={C.white} /> : <Text style={s.btnText}>Войти</Text>}
            </TouchableOpacity>
            <View style={s.links}>
              <TouchableOpacity onPress={sendCode} disabled={resendIn > 0 || busy}>
                <Text style={[s.link, (resendIn > 0 || busy) && s.linkDisabled]}>
                  {resendIn > 0 ? `Отправить ещё раз через ${resendIn} с` : 'Отправить код ещё раз'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep('email');
                  setError('');
                }}
                disabled={busy}
              >
                <Text style={s.link}>Изменить почту</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.dark },
  content: { flexGrow: 1, paddingHorizontal: 28, gap: 14 },
  logo: { flexDirection: 'row', marginBottom: 28 },
  logoText: { color: C.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  title: { color: C.white, fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 22, marginBottom: 10 },
  email: { color: C.white, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.white,
    fontSize: 17,
  },
  codeInput: { fontSize: 28, letterSpacing: 10, textAlign: 'center', fontWeight: '700' },
  error: { color: '#FCA5A5', fontSize: 14, lineHeight: 20 },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 12 },
  link: { color: '#93C5FD', fontSize: 14, fontWeight: '600', paddingVertical: 6 },
  linkDisabled: { color: 'rgba(255,255,255,0.35)' },
});
