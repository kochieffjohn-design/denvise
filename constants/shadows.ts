// constants/shadows.ts — Двухслойные тени Denvise (RN поддерживает 1 слой shadow на iOS,
// поэтому "far" слой кладём на внешний View, а "near" — на внутренний/сам элемент)

import { Platform, ViewStyle } from 'react-native';

function shadowStyle(opacity: number, h: number, r: number, color = '#1A2340'): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: Math.max(1, Math.round(r / 3)) };
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: r,
    shadowOffset: { width: 0, height: h },
  };
}

// e1 — состояние покоя карточки: far-слой (видимый), near добавляем как контур
export const shadowCard: ViewStyle = shadowStyle(0.06, 6, 14);

// e2 — активная/раскрытая карточка, более глубокая
export const shadowActive: ViewStyle = shadowStyle(0.11, 12, 24);

// e0 — нажатое состояние, тень мягче и ближе
export const shadowPressed: ViewStyle = shadowStyle(0.05, 2, 6);

// Цветная тень кнопки (тонирована в accent, не в navy)
export const shadowButtonAccent: ViewStyle = shadowStyle(0.32, 8, 16, '#3B82F6');

// Тень хедера (глубокая, чёрный navy)
export const shadowHeader: ViewStyle = shadowStyle(0.30, 10, 26);