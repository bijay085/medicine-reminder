import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, FONTS, TEXT } from '../theme';
import { formatISODate } from '../utils/dateTime';

interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD". If invalid/empty, the picker opens on today. */
  value: string;
  onChangeValue: (value: string) => void;
  minimumDate?: Date;
  error?: string;
}

function parseOrToday(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (year && month && day) {
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function formatDisplay(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseOrToday(value));
}

/** Date input backed by the native date picker — no manual YYYY-MM-DD typing. */
export function DateField({ label, value, onChangeValue, minimumDate, error }: DateFieldProps) {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parseOrToday(value),
        mode: 'date',
        minimumDate,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) {
            onChangeValue(formatISODate(selected));
          }
        },
      });
    } else {
      setIosPickerOpen(true);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDisplay(value)}`}
        onPress={openPicker}
        style={[styles.box, error && styles.boxError]}
      >
        <Text style={styles.value}>{formatDisplay(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosPickerOpen ? (
        <DateTimePicker
          value={parseOrToday(value)}
          mode="date"
          display="spinner"
          minimumDate={minimumDate}
          onChange={(event, selected) => {
            setIosPickerOpen(false);
            if (event.type === 'set' && selected) onChangeValue(formatISODate(selected));
          }}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.input,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  boxError: {
    borderColor: COLORS.danger,
  },
  value: {
    color: COLORS.ink,
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
  },
  error: {
    ...TEXT.caption,
    color: COLORS.danger,
  },
});
