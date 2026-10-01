import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../constants/Colors';
import { authEnabled, SessionProvider, useSession } from '../lib/session';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SessionProvider>
        <RootStack />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

// Порядок первого входа: онбординг → вход → приложение. Каждая группа
// экранов доступна только в своём состоянии; при смене состояния Expo Router
// сам переводит на доступный экран.
function RootStack() {
  const { loading, onboarded, user } = useSession();
  // Пока читаем состояние — фон как у онбординга, без мелькания экранов
  if (loading) return <View style={{ flex: 1, backgroundColor: C.dark }} />;

  const signedIn = !authEnabled || !!user;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: false,
      }}
    >
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded && !signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded && signedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}
