import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from './Touchable';
import { C } from '../constants/Colors';

type Props = {
  title: string;
  subtitle?: string;
  badge?: { label: string; color: string; bg: string };
  onBack?: () => void;
  rightSlot?: React.ReactNode;
};

export default function ScreenHeader({ title, subtitle, badge, onBack, rightSlot }: Props) {
  return (
    <LinearGradient
      colors={[C.navyDeep, C.navyBase]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.header}
    >
      <View style={s.glow} pointerEvents="none" />
      <View style={s.dotGrid} pointerEvents="none">
        {Array.from({ length: 48 }).map((_, i) => (
          <View key={i} style={s.dot} />
        ))}
      </View>

      <View style={s.row}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
            <Text style={s.backT}>Назад</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {badge && (
          <View style={[s.badge, { backgroundColor: badge.bg }]}>
            <Text style={[s.badgeT, { color: badge.color }]}>{badge.label}</Text>
          </View>
        )}
        {rightSlot}
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 14,
    paddingHorizontal: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.30)',
  },
  dotGrid: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0.5,
  },
  dot: {
    width: 15, height: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  backT: { color: '#fff', fontSize: 13, fontWeight: '500' },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeT: { fontSize: 12, fontWeight: '700' },
});