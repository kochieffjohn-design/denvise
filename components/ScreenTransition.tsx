import { useCallback, useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

// Анимация смены «экрана» внутри одного раздела (список → детали → результат).
// Навигацией такие переходы не являются — раздел просто рендерит другое
// содержимое, поэтому без этого экран подменялся мгновенно, как на сайте.
//
// Новое содержимое проявляется со сдвигом: вглубь (depth растёт) — справа,
// назад — слева. Смена вкладок анимируется самим таб-баром (animation: 'shift').

const DURATION = 300;
// Насколько экран въезжает сбоку. 24px читалось как «проявление», а не въезд.
const OFFSET = 40;
// Плавный старт и плавная остановка (как CSS ease-in-out). Прежняя
// Easing.out(cubic) проходила половину пути за первые ~40 мс — ощущалось
// как резкое переключение, а не въезд.
const EASING = Easing.bezier(0.42, 0, 0.58, 1);

type Props = {
  id: string;
  depth: number;
  /** Анимировать и самый первый показ (вход в раздел), а не только смену экрана. */
  animateOnMount?: boolean;
  children: ReactNode;
};

export function ScreenTransition({ id, depth, animateOnMount = false, children }: Props) {
  // При анимированном первом показе стартуем с 0, чтобы не мелькнул готовый экран
  const [progress] = useState(() => new Animated.Value(animateOnMount ? 0 : 1));
  // Какой экран показан; animate — нужно ли проиграть появление
  const [shown, setShown] = useState({ id, depth, direction: 1, animate: animateOnMount });

  // Экран сменился: направление считаем до отрисовки (вглубь — справа, назад — слева)
  if (shown.id !== id) {
    setShown({ id, depth, direction: depth >= shown.depth ? 1 : -1, animate: true });
  }

  useLayoutEffect(() => {
    if (!shown.animate) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.linear, // кривые — отдельно для сдвига и прозрачности, ниже
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shown, progress]);

  // Сдвиг — плавный въезд за всё время перехода
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [OFFSET * shown.direction, 0], easing: EASING });
  // Прозрачность — быстрее, к середине экран уже виден: иначе после нажатия
  // ~0.1 с почти пустой фон (старый экран исчезает сразу) и кажется, что тормозит
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], easing: Easing.out(Easing.quad) });
  return <Animated.View style={[s.fill, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

/**
 * Для экранов с несколькими `return`: вызвать в начале компонента (до ранних
 * return) и обернуть каждый результат — `return t(<View>…</View>)`.
 * id — какой экран показан, depth — насколько он «глубоко» (0 — список).
 *
 * Каждый вход в раздел (фокус вкладки) тоже анимируется — справа, как шаг
 * вглубь. Для этих разделов стандартная анимация вкладок отключена в
 * app/(tabs)/_layout.tsx: она брала направление из порядка вкладок, и раздел,
 * открытый с Главной, въезжал слева, будто это возврат.
 */
export function useScreenTransition(id: string, depth: number, { enterOnFocus = true } = {}) {
  const focused = useIsFocused();
  // Номер захода в раздел: растёт при каждом возврате фокуса
  const [visit, setVisit] = useState({ n: 0, focused: false });
  if (visit.focused !== focused) setVisit({ n: focused ? visit.n + 1 : visit.n, focused });
  const n = enterOnFocus ? visit.n : 0;
  const key = `${n}:${id}`;
  // Новый заход — «вглубь» относительно любого экрана раздела
  const entryDepth = n * 100 + depth;

  return useCallback(
    (el: ReactElement) => (
      <ScreenTransition id={key} depth={entryDepth} animateOnMount={enterOnFocus}>
        {el}
      </ScreenTransition>
    ),
    [key, entryDepth, enterOnFocus]
  );
}

const s = StyleSheet.create({ fill: { flex: 1 } });
