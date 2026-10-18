import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, TEXT } from '../theme';

interface Choice<T extends string | number> {
  label: string;
  value: T;
}

interface ChoiceChipsProps<T extends string | number> {
  label: string;
  options: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function ChoiceChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: COLORS.input,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
    borderWidth: 1.5,
  },
  chipLabel: {
    ...TEXT.caption,
    fontSize: 13,
  },
  chipLabelSelected: {
    color: COLORS.accent,
    fontFamily: FONTS.bodyBold,
  },
  pressed: {
    opacity: 0.72,
  },
});
