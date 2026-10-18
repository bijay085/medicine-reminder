import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS, FONTS, GRADIENTS } from '../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  accessibilityLabel,
}: ButtonProps) {
  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.primaryWrap,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <LinearGradient
          colors={GRADIENTS.primaryButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.base}
        >
          {icon}
          <Text style={[styles.label, styles.primaryLabel]}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryWrap: {
    borderRadius: 14,
  },
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondary: {
    backgroundColor: '#2A2450',
    borderColor: '#4A4270',
    borderWidth: 1,
  },
  danger: {
    backgroundColor: '#3A1826',
    borderColor: '#6B3040',
    borderWidth: 1,
  },
  text: {
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 2,
    paddingVertical: 4,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONTS.bodyBold,
  },
  primaryLabel: {
    color: COLORS.primaryInk,
  },
  secondaryLabel: {
    color: COLORS.ink,
  },
  dangerLabel: {
    color: COLORS.danger,
  },
  textLabel: {
    color: COLORS.accent,
  },
});
