import { useCallback, useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useIsFocused } from 'expo-router';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { C } from '../constants/Colors';

// Анимация смены «экрана» внутри раздела (список → детали → результат).
// Навигацией такие переходы не являются — раздел просто рендерит другое
// содержимое, поэтому без этого экран подменялся мгновенно, как на сайте.
//
// Переход последовательный: старый экран гаснет, и только потом проявляется
// новый (с лёгким приближением). Два экрана одновременно не видны никогда —
// иначе они накладываются полупрозрачными и получается каша. Сдвига вбок нет:
// экран, въезжающий на пустое место, выглядел обрезанным (полоса у края).
//
// Вход в раздел с Главной — только проявление нового экрана: Главная в
// другой вкладке и пропадает сразу (анимация вкладок отключена в _layout).

const DURATION = 300;
// Доля времени, за которую гаснет старый экран; новый начинает проявляться после
const OUT_END = 0.35;
// Масштаб, с которого проявляется новый экран: вглубь — чуть меньше (приближается),
// назад — чуть больше (как будто отъехали)
const SCALE_PUSH = 0.97;
const SCALE_POP = 1.03;

type Props = {
  /** Какой экран раздела показан. */
  id: string;
  /** Глубина экрана: 0 — список; растёт — переход вглубь, падает — назад. */
  depth: number;
  /** Номер захода в раздел; сменился — анимация входа (проявление). */
  entry: number;
  children: ReactNode;
};

type Shown = {
  id: string;
  depth: number;
  entry: number;
  el: ReactNode;
  kind: 'none' | 'push' | 'pop' | 'entry';
  /** Предыдущий экран — гаснет в начале перехода */
  prev: { id: string; el: ReactNode } | null;
};

export function ScreenTransition({ id, depth, entry, children }: Props) {
  const [progress] = useState(() => new Animated.Value(entry > 0 ? 0 : 1));
  const [shown, setShown] = useState<Shown>({
    id, depth, entry, el: children, kind: entry > 0 ? 'entry' : 'none', prev: null,
  });

  // Смена экрана или захода — решаем, какой переход играть (до отрисовки)
  if (shown.entry !== entry) {
    setShown({ id, depth, entry, el: children, kind: 'entry', prev: null });
  } else if (shown.id !== id) {
    setShown({
      id, depth, entry, el: children,
      kind: depth >= shown.depth ? 'push' : 'pop',
      prev: { id: shown.id, el: shown.el },
    });
  } else if (shown.el !== children) {
    setShown({ ...shown, el: children }); // тот же экран обновился — запоминаем
  }

  const { kind } = shown;
  useLayoutEffect(() => {
    if (kind === 'none') return;
    progress.setValue(0);
    // Стартуем, когда новый экран уже отрисован (через кадр): иначе на медленном
    // устройстве таймер успевал пройти полпути до первого видимого кадра
    let anim: Animated.CompositeAnimation | null = null;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        anim = Animated.timing(progress, {
          toValue: 1,
          duration: kind === 'entry' ? DURATION * (1 - OUT_END) : DURATION,
          easing: Easing.linear, // кривые — по отдельности для каждого слоя, ниже
          useNativeDriver: Platform.OS !== 'web',
        });
        anim.start(({ finished }) => {
          if (finished) setShown((s) => (s.kind === kind ? { ...s, kind: 'none', prev: null } : s));
        });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      anim?.stop();
    };
  }, [shown.id, shown.entry, kind, progress]);

  // Когда новый экран начинает проявляться: при входе старого нет — сразу
  const inStart = kind === 'entry' ? 0 : OUT_END;
  const fromScale = kind === 'pop' ? SCALE_POP : SCALE_PUSH;

  const currentStyle =
    kind === 'none'
      ? null
      : {
          opacity: progress.interpolate({
            inputRange: [0, inStart, 1],
            outputRange: [0, 0, 1],
            easing: Easing.out(Easing.cubic),
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, inStart, 1],
                outputRange: [fromScale, fromScale, 1],
                easing: Easing.out(Easing.cubic),
                extrapolate: 'clamp',
              }),
            },
          ],
        };
  // Старый экран гаснет полностью к OUT_END — до того, как появится новый
  const prevStyle = {
    opacity: progress.interpolate({
      inputRange: [0, OUT_END, 1],
      outputRange: [1, 0, 0],
      easing: Easing.in(Easing.quad),
      extrapolate: 'clamp',
    }),
  };

  return (
    <View style={s.fill}>
      {shown.prev && (
        <Animated.View key={shown.prev.id} testID="screen-prev" style={[s.layer, prevStyle]} pointerEvents="none">
          {shown.prev.el}
        </Animated.View>
      )}
      <Animated.View key={shown.id} testID="screen-current" style={[s.layer, currentStyle]}>
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Для экранов с несколькими `return`: вызвать в начале компонента (до ранних
 * return) и обернуть каждый результат — `return t(<View>…</View>)`.
 * id — какой экран показан, depth — насколько он «глубоко» (0 — список).
 *
 * enterOnFocus: каждый вход в раздел (фокус вкладки) анимируется проявлением.
 */
export function useScreenTransition(id: string, depth: number, { enterOnFocus = true } = {}) {
  const focused = useIsFocused();
  // Номер захода в раздел: растёт при каждом возврате фокуса
  const [visit, setVisit] = useState({ n: 0, focused: false });
  if (visit.focused !== focused) setVisit({ n: focused ? visit.n + 1 : visit.n, focused });
  const entry = enterOnFocus ? visit.n : 0;

  return useCallback(
    (el: ReactElement) => (
      <ScreenTransition id={id} depth={depth} entry={entry}>
        {el}
      </ScreenTransition>
    ),
    [id, depth, entry]
  );
}

const s = StyleSheet.create({
  // Непрозрачный фон: неактивные вкладки не скрываются, а лежат слоем ниже —
  // без фона Главная просвечивала сквозь проявляющийся раздел
  fill: { flex: 1, overflow: 'hidden', backgroundColor: C.bg },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
