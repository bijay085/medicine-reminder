import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, TEXT } from '../theme';
import { from12Hour, to12Hour, type Meridiem } from '../utils/dateTime';

interface TimeFieldProps {
  label: string;
  /** 24-hour "HH:mm" value. */
  value: string;
  /** Called with a 24-hour "HH:mm" string whenever hour+minute+meridiem form a valid time. */
  onChangeValue: (value: string) => void;
  error?: string;
}

/**
 * 12-hour time input (hour, minute, AM/PM) that stores and reports a
 * 24-hour "HH:mm" string underneath, so scheduling logic never needs to
 * know about AM/PM.
 */
export function TimeField({ label, value, onChangeValue, error }: TimeFieldProps) {
  const parsed = to12Hour(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [meridiem, setMeridiem] = useState<Meridiem>(parsed.meridiem);

  function commit(nextHour: string, nextMinute: string, nextMeridiem: Meridiem) {
    const next = from12Hour(nextHour, nextMinute, nextMeridiem);
    if (next) onChangeValue(next);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={hour}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
            setHour(digits);
            commit(digits, minute, meridiem);
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="8"
          placeholderTextColor="#6E6890"
          selectTextOnFocus
          style={[styles.box, error && styles.boxError]}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          value={minute}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
            setMinute(digits);
            commit(hour, digits, meridiem);
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="00"
          placeholderTextColor="#6E6890"
          selectTextOnFocus
          style={[styles.box, error && styles.boxError]}
        />
        <View style={styles.meridiemGroup}>
          {(['AM', 'PM'] as const).map((option) => {
            const selected = meridiem === option;
            return (
              <Text
                key={option}
                onPress={() => {
                  setMeridiem(option);
                  commit(hour, minute, option);
                }}
                style={[styles.meridiemChip, selected && styles.meridiemChipSelected]}
              >
                {option}
              </Text>
            );
          })}
        </View>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  box: {
    width: 56,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    backgroundColor: COLORS.input,
    color: COLORS.ink,
    textAlign: 'center',
    fontSize: 17,
  },
  boxError: {
    borderColor: COLORS.danger,
  },
  colon: {
    color: COLORS.ink,
    fontSize: 18,
  },
  meridiemGroup: {
    flexDirection: 'row',
    marginLeft: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  meridiemChip: {
    minWidth: 48,
    minHeight: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 14,
    color: COLORS.muted,
    fontSize: 14,
    backgroundColor: COLORS.input,
  },
  meridiemChipSelected: {
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accent,
  },
  error: {
    ...TEXT.caption,
    color: COLORS.danger,
  },
});
