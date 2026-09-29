import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Отступы от краёв экрана с учётом выреза («чёлки»), строки состояния и
// полоски «домой». Раньше они были зашиты как `Platform.OS === 'ios' ? 54 : 44`
// и не знали реального устройства: на iPhone с Dynamic Island шапка залезала
// под вырез, а в браузере над заголовком оставалась пустая полоса.
// На вебе insets берутся из CSS env(safe-area-inset-*) — они ненулевые только
// в установленном PWA при viewport-fit=cover.

// «Воздух» между вырезом (или краем экрана) и содержимым шапки.
const HEADER_GAP = 16;
// Высота содержимого таб-бара (иконка + подпись) без системного отступа снизу.
const TAB_BAR_CONTENT_HEIGHT = 56;
// Минимальный отступ снизу у таб-бара на устройствах без полоски «домой».
const TAB_BAR_MIN_BOTTOM = 8;

/** paddingTop для тёмной шапки экрана. */
export function useHeaderTopPadding(): number {
  return useSafeAreaInsets().top + HEADER_GAP;
}

/** Высота и нижний отступ таб-бара. */
export function useTabBarMetrics(): { height: number; paddingBottom: number } {
  const paddingBottom = Math.max(useSafeAreaInsets().bottom, TAB_BAR_MIN_BOTTOM);
  return { height: TAB_BAR_CONTENT_HEIGHT + paddingBottom, paddingBottom };
}
