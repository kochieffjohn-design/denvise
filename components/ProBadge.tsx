import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

/** Метка на карточке Pro-кейса: с замком, если Pro нет. */
export function ProBadge({ locked = true }: { locked?: boolean }) {
  return (
    <View style={s.badge}>
      {locked && <Ionicons name="lock-closed" size={11} color="#A37A22" />}
      <Text style={s.text}>PRO</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: '#F8F2E2', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  text: { fontSize: 11, fontWeight: '800', color: '#A37A22', letterSpacing: 0.5 },
});
