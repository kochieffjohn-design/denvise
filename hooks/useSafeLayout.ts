import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Отступы от краёв экрана с учётом выреза («чёлки»), строки состояния и
// полоски «домой». Раньше они были зашиты как `Platform.OS === 'ios' ? 54 : 44`
// и не знали реального устройства: на iPhone с Dynamic Island шапка залезала
// под вырез, а в браузере над заголовком оставалась пустая полоса.
// На вебе insets берутся из CSS env(safe-area-inset-*) — они ненулевые только
// в установленном PWA при viewport-fit=cover.

// «Воздух» между вырезом (или краем экрана) и содержимым шапки.
const HEADER_GAP = 16;
// Высота иконки таб-бара вместе с подписью (см. TabIcon в app/(tabs)/_layout.tsx).
export const TAB_ICON_HEIGHT = 44;
// Одинаковый отступ сверху и снизу от иконок — они стоят по центру панели.
// С полоской «домой» он больше, чтобы подписи не наезжали на неё: полоска
// занимает нижние ~13pt экрана, меньше 14 ставить не стоит.
const TAB_BAR_GAP_HOME_INDICATOR = 14;
const TAB_BAR_GAP = 10;
// Верхняя граница панели (borderTopWidth в app/(tabs)/_layout.tsx).
const TAB_BAR_BORDER = 1;

/** paddingTop для тёмной шапки экрана. */
export function useHeaderTopPadding(): number {
  return useSafeAreaInsets().top + HEADER_GAP;
}

/**
 * paddingBottom для нижнего блока полноэкранного экрана без таб-бара
 * (онбординг): над полоской «домой» + 10px, но не меньше `min`.
 */
export function useScreenBottomPadding(min = 28): number {
  return Math.max(useSafeAreaInsets().bottom + 10, min);
}

/** Высота и вертикальные отступы таб-бара: иконки по центру панели. */
export function useTabBarMetrics(): { height: number; paddingTop: number; paddingBottom: number } {
  const gap = useSafeAreaInsets().bottom > 0 ? TAB_BAR_GAP_HOME_INDICATOR : TAB_BAR_GAP;
  return { height: TAB_ICON_HEIGHT + gap * 2 + TAB_BAR_BORDER, paddingTop: gap, paddingBottom: gap };
}
