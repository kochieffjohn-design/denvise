import { useEffect, useState } from 'react';
import { Platform, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

// Замена TouchableOpacity из react-native для всех кнопок приложения.
//
// В react-native-web у TouchableOpacity отклик запаздывает: касание
// регистрируется через 50ms, и ещё 150ms кнопка плавно тускнеет, так что
// короткое касание почти не видно. Здесь прозрачность меняется без анимации.
// Интерфейс совместим с TouchableOpacity: onPress, disabled, style,
// activeOpacity, onPressIn/onPressOut.
//
// Прокрутка: если свайп начинают на кнопке, она не должна мигать «нажатой»
// (как в iOS). На вебе React Native Web не отменяет нажатие большой карточки
// при небольшом сдвиге пальца, поэтому следим за прокруткой страницы сами:
// во время и сразу после прокрутки подсветка не показывается.

const isWeb = Platform.OS === 'web';
// Начало нажатия без задержки (у Pressable на вебе по умолчанию 50ms, на native 0).
// В типах Pressable для native этого пропа нет, поэтому передаём его отдельно.
const noPressDelay = isWeb ? ({ delayPressIn: 0 } as object) : null;

// Время последней прокрутки любого контейнера на странице
let lastScrollAt = 0;
const scrollListeners = new Set<() => void>();
if (isWeb && typeof window !== 'undefined') {
  const onScrollStart = () => {
    lastScrollAt = Date.now();
    scrollListeners.forEach((f) => f());
  };
  // scroll не всплывает, но ловится на фазе перехвата
  window.addEventListener('scroll', onScrollStart, { capture: true, passive: true });
  // pointercancel — браузер забрал жест под прокрутку; приходит раньше первого
  // scroll, а сам React Native Web нажатие при этом не отменяет
  window.addEventListener('pointercancel', onScrollStart, { capture: true, passive: true });
}
// Нажатие сразу после прокрутки — продолжение жеста листания, а не тап
const SCROLL_GRACE_MS = 100;
// Через сколько при удержании пальца появляется подсветка (как в iOS: свайп
// обычно начинается раньше, и тогда кнопка не мигает)
const VISUAL_DELAY_MS = 60;
// Сколько держится подсветка при быстром тапе, когда палец убрали раньше
const TAP_FLASH_MS = 90;
// До какого момента держать подсветку быстрого тапа (одна на всё приложение:
// одновременно отпускают только одну кнопку)
let flashUntil = 0;

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Прозрачность в нажатом состоянии; 1 — без затемнения (свой отклик, например сжатие). */
  activeOpacity?: number;
};

export function TouchableOpacity({ style, activeOpacity = 0.5, onPressIn, onPressOut, ...rest }: Props) {
  // down — палец на кнопке; pressed — подсветка видна
  const [down, setDown] = useState(false);
  const [pressed, setPressed] = useState(false);

  // Подсветка при удержании — через VISUAL_DELAY_MS, если за это время не
  // началась прокрутка (тогда это свайп, а не нажатие)
  useEffect(() => {
    if (!down || !isWeb) return; // на native подсветка включается сразу в handlePressIn
    const t = setTimeout(() => {
      if (Date.now() - lastScrollAt < SCROLL_GRACE_MS) return;
      setPressed(true);
      onPressIn?.({} as GestureResponderEvent);
    }, VISUAL_DELAY_MS);
    // Прокрутка во время нажатия — снимаем подсветку
    const cancel = () => {
      clearTimeout(t);
      setDown(false);
    };
    scrollListeners.add(cancel);
    return () => {
      clearTimeout(t);
      scrollListeners.delete(cancel);
    };
  }, [down, onPressIn]);

  // Подсветка снимается, когда палец убран (или началась прокрутка)
  useEffect(() => {
    if (down || !pressed) return;
    const t = setTimeout(() => {
      setPressed(false);
      onPressOut?.({} as GestureResponderEvent);
    }, flashUntil - Date.now());
    return () => clearTimeout(t);
  }, [down, pressed, onPressOut]);

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!isWeb) {
      // На native прокрутку отменяет сам ScrollView — подсветка сразу
      setDown(true);
      setPressed(true);
      onPressIn?.(e);
      return;
    }
    if (Date.now() - lastScrollAt < SCROLL_GRACE_MS) return;
    setDown(true);
  };
  // Палец убран или жест отменён (браузер забрал его под прокрутку —
  // pointercancel): подсветку не включаем
  const handlePressOut = () => {
    if (!down) return;
    flashUntil = 0;
    setDown(false);
  };
  // Настоящее нажатие. Быстрый тап: подсветка не успела появиться — мигнём ею,
  // чтобы нажатие было видно (onPress не вызывается при отменённом жесте)
  const handlePress = (e: GestureResponderEvent) => {
    if (isWeb && !pressed) {
      setPressed(true);
      onPressIn?.(e);
      flashUntil = Date.now() + TAP_FLASH_MS;
    }
    rest.onPress?.(e);
  };

  return (
    <Pressable
      {...noPressDelay}
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={rest.onPress ? handlePress : undefined}
      style={[style, pressed && activeOpacity < 1 && { opacity: activeOpacity }]}
    />
  );
}
