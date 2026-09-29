import { C } from '@/constants/Colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTabBarMetrics } from '@/hooks/useSafeLayout';

function TabIcon({ ionIcon, mciIcon, label, focused }: {
  ionIcon?: string; mciIcon?: string; label: string; focused: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, focused && { backgroundColor: C.light }]}>
        {ionIcon
          ? <Ionicons name={ionIcon as any} size={22} color={focused ? C.primary : '#9aa3b0'} />
          : <MaterialCommunityIcons name={mciIcon as any} size={22} color={focused ? C.primary : '#9aa3b0'} />
        }
      </View>
      <Text style={[styles.label, focused && { color: C.primary, fontWeight: '700' }]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const tabBar = useTabBarMetrics();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: tabBar.height,
          paddingBottom: tabBar.paddingBottom,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarShowLabel: false,
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="index"     options={{ tabBarIcon: ({ focused }) => <TabIcon ionIcon="home-outline"   label="Главная" focused={focused} /> }} />
      <Tabs.Screen name="exam"      options={{ tabBarIcon: ({ focused }) => <TabIcon ionIcon="school-outline" label="Экзамен" focused={focused} /> }} />
      <Tabs.Screen name="dentai"    options={{ tabBarIcon: ({ focused }) => <TabIcon mciIcon="brain"          label="ДентИИ" focused={focused} /> }} />
      <Tabs.Screen name="profile"   options={{ tabBarIcon: ({ focused }) => <TabIcon ionIcon="person-outline" label="Профиль" focused={focused} /> }} />
      <Tabs.Screen name="patient"   options={{ href: null }} />
      <Tabs.Screen name="diag"      options={{ href: null }} />
      <Tabs.Screen name="comm"      options={{ href: null }} />
      <Tabs.Screen name="reception" options={{ href: null }} />
      <Tabs.Screen name="consult"   options={{ href: null }} />
      <Tabs.Screen name="stations"  options={{ href: null }} />
      <Tabs.Screen name="emergencies" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 3, paddingTop: 6, width: 72 },
  iconWrap: { width: 40, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  label: { fontSize: 10, color: '#9aa3b0', fontWeight: '500', letterSpacing: 0.2 },
});