import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, TEXT } from '../theme';
import type { Weekday } from '../types/domain';

interface WeekdayPickerProps {
  label: string;
  value: Weekday[];
  onChange: (value: Weekday[]) => void;
}

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

/** Multi-select day-of-week chips — Mon/Wed/Fri, etc. */
export function WeekdayPicker({ label, value, onChange }: WeekdayPickerProps) {
  function toggle(day: Weekday) {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day]);
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {WEEKDAYS.map(({ value: day, label: dayLabel }) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(day)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{dayLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 9,
  },
  label: {
    ...TEXT.h3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 48,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  chipSelected: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  chipLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontFamily: FONTS.bodyMedium,
  },
  chipLabelSelected: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
  },
});
