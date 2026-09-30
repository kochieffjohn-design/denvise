import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, type DimensionValue } from 'react-native';
import { C } from '../constants/Colors';

// Заглушки на время загрузки вместо спиннеров: показывают, ЧТО появится
// (строки текста, реплика собеседника), а не просто «что-то грузится».

const useNativeDriver = Platform.OS !== 'web';

/** Значение 0→1→0 по кругу — общий «пульс» для заглушек. */
function usePulse(duration: number, delay = 0) {
  const [value] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver }),
        Animated.timing(value, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, delay]);
  return value;
}

/** Несколько строк-заглушек текста. Последняя короче — как конец абзаца. */
export function SkeletonLines({ widths = ['92%', '100%', '78%', '55%'] }: { widths?: DimensionValue[] }) {
  const pulse = usePulse(1400);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Animated.View style={[s.lines, { opacity }]} accessibilityLabel="Загрузка">
      {widths.map((w, i) => (
        <View key={i} style={[s.line, { width: w }]} />
      ))}
    </Animated.View>
  );
}

/** «Печатает…» — три точки по очереди подпрыгивают, как в мессенджерах. */
export function TypingDots({ color = C.muted }: { color?: string }) {
  return (
    <View style={s.dots} accessibilityLabel="Собеседник печатает">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} color={color} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const pulse = usePulse(1000, delay);
  return (
    <Animated.View
      style={[
        s.dot,
        {
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
        },
      ]}
    />
  );
}

const s = StyleSheet.create({
  lines: { gap: 9, paddingVertical: 2 },
  line: { height: 11, borderRadius: 6, backgroundColor: '#DCE3EC' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
