import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS } from '../theme';

export type AppScreen = 'today' | 'medicines' | 'alarms' | 'history' | 'settings';

interface BottomNavProps {
  active: AppScreen;
  onChange: (screen: AppScreen) => void;
}

const ITEMS: {
  label: string;
  value: AppScreen;
  icon: ComponentProps<typeof Ionicons>['name'];
  activeIcon: ComponentProps<typeof Ionicons>['name'];
}[] = [
  { label: 'Today', value: 'today', icon: 'today-outline', activeIcon: 'today' },
  { label: 'Medicines', value: 'medicines', icon: 'medical-outline', activeIcon: 'medical' },
  { label: 'Alarms', value: 'alarms', icon: 'alarm-outline', activeIcon: 'alarm' },
  { label: 'History', value: 'history', icon: 'time-outline', activeIcon: 'time' },
  { label: 'Settings', value: 'settings', icon: 'options-outline', activeIcon: 'options' },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <View style={styles.navShell}>
      <View accessibilityRole="tablist" style={styles.navigation}>
        {ITEMS.map((item) => {
          const selected = active === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(item.value)}
              style={({ pressed }) => [
                styles.navItem,
                selected && styles.navItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={selected ? item.activeIcon : item.icon}
                size={20}
                color={selected ? COLORS.accent : COLORS.muted}
              />
              <Text style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navShell: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
  },
  navigation: {
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 12, 42, 0.55)',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 5,
  },
  navItem: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 15,
  },
  navItemActive: {
    backgroundColor: COLORS.accentSoft,
  },
  pressed: {
    opacity: 0.68,
  },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONTS.bodySemiBold,
  },
  labelActive: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
  },
});
