import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, FONTS, TEXT } from '../theme';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor="#6E6890"
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    ...TEXT.h3,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.input,
    color: COLORS.ink,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  error: {
    ...TEXT.caption,
    color: COLORS.danger,
  },
  hint: {
    ...TEXT.caption,
  },
});
