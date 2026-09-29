import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

// Замена TouchableOpacity из react-native для всех кнопок приложения.
//
// В react-native-web у TouchableOpacity отклик запаздывает: касание
// регистрируется через 50ms, и ещё 150ms кнопка плавно тускнеет, так что
// короткое касание почти не видно. Здесь прозрачность меняется сразу.
// Интерфейс совместим с TouchableOpacity: onPress, disabled, style,
// activeOpacity, onPressIn/onPressOut.

// На вебе у Pressable задержка начала нажатия по умолчанию 50ms, на native — 0.
// В типах Pressable для native этого пропа нет, поэтому передаём его отдельно.
const noPressDelay = Platform.OS === 'web' ? ({ delayPressIn: 0 } as object) : null;

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Прозрачность в нажатом состоянии; 1 — без затемнения (свой отклик, например сжатие). */
  activeOpacity?: number;
};

export function TouchableOpacity({ style, activeOpacity = 0.5, ...rest }: Props) {
  return (
    <Pressable
      {...noPressDelay}
      {...rest}
      style={({ pressed }) => [style, pressed && activeOpacity < 1 && { opacity: activeOpacity }]}
    />
  );
}
