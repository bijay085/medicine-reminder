import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ChoiceChips } from '../components/ChoiceChips';
import { DateField } from '../components/DateField';
import { Field } from '../components/Field';
import { GlassCard } from '../components/GlassCard';
import { TimeField } from '../components/TimeField';
import { WeekdayPicker } from '../components/WeekdayPicker';
import { cancelNotificationBatch, scheduleAlarmNotification, scheduleWeeklyAlarm } from '../notifications';
import { playSound } from '../sounds';
import { COLORS, TEXT } from '../theme';
import type { AppData, UpdateAppData, Weekday } from '../types/domain';
import { combineLocalDateAndTime, formatISODate, isValidISODate, isValidTimeOfDay } from '../utils/dateTime';

interface AlarmsScreenProps {
  data: AppData;
  updateData: UpdateAppData;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function createId(): string {
  return `alarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatClockTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function describeAlarm(alarm: AppData['alarms'][number]): string {
  if (alarm.repeat === 'once' && alarm.date) {
    const date = new Date(`${alarm.date}T${alarm.time}:00`);
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
  const days = (alarm.weekdays ?? []).slice().sort();
  const dayNames = days.length === 7 ? 'Every day' : days.map((d) => WEEKDAY_LABELS[d]).join(', ');
  return `${dayNames} · ${formatClockTime(alarm.time)}`;
}

export function AlarmsScreen({ data, updateData }: AlarmsScreenProps) {
  const today = useMemo(() => formatISODate(new Date()), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState<'once' | 'weekly'>('once');
  const [date, setDate] = useState<string>(today);
  const [time, setTime] = useState('09:00');
  const [weekdays, setWeekdays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const upcoming = useMemo(() => {
    return [...data.alarms].sort((a, b) => {
      const aWhen = a.repeat === 'once' ? `${a.date}T${a.time}` : `9999-${a.time}`;
      const bWhen = b.repeat === 'once' ? `${b.date}T${b.time}` : `9999-${b.time}`;
      return aWhen.localeCompare(bWhen);
    });
  }, [data.alarms]);

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setNotes('');
    setRepeat('once');
    setDate(today);
    setTime('09:00');
    setWeekdays([1, 2, 3, 4, 5]);
    setError(undefined);
  }

  function openEdit(alarm: AppData['alarms'][number]) {
    setEditingId(alarm.id);
    setTitle(alarm.title);
    setNotes(alarm.notes ?? '');
    setRepeat(alarm.repeat);
    setDate(alarm.date ?? today);
    setTime(alarm.time);
    setWeekdays(alarm.weekdays ?? [1, 2, 3, 4, 5]);
    setError(undefined);
    setFormOpen(true);
  }

  async function saveAlarm() {
    if (!title.trim()) {
      setError('Give this alarm a name, like "Hospital appointment".');
      return;
    }
    if (!isValidTimeOfDay(time)) {
      setError('Pick a valid time.');
      return;
    }

    setSaving(true);
    try {
      const existing = editingId ? data.alarms.find((alarm) => alarm.id === editingId) : undefined;

      if (repeat === 'once') {
        if (!isValidISODate(date)) {
          setError('Use a valid date.');
          return;
        }
        let when: Date;
        try {
          when = combineLocalDateAndTime(date, time);
        } catch {
          setError('That date and time combination is invalid.');
          return;
        }

        const result = await scheduleAlarmNotification(title.trim(), notes.trim() || undefined, when);
        if (result.status === 'in_past') {
          setError('Pick a date and time in the future.');
          return;
        }
        if (result.status === 'denied') {
          setError('Notifications are blocked for this app — enable them in your phone settings.');
          return;
        }
        if (existing) await cancelNotificationBatch(existing.notificationIds);

        playSound('add');
        const saved = {
          id: existing?.id ?? createId(),
          title: title.trim(),
          notes: notes.trim() || undefined,
          time: time as AppData['alarms'][number]['time'],
          repeat: 'once' as const,
          date,
          notificationIds: result.notificationId ? [result.notificationId] : [],
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        updateData((current) => ({
          ...current,
          alarms: existing
            ? current.alarms.map((alarm) => (alarm.id === existing.id ? saved : alarm))
            : [...current.alarms, saved],
        }));
        if (result.status === 'unsupported') {
          Alert.alert(
            'Saved, but not scheduled here',
            'Notifications only fire from the installed app, not this preview.',
          );
        }
      } else {
        if (weekdays.length === 0) {
          setError('Pick at least one day.');
          return;
        }

        const result = await scheduleWeeklyAlarm(title.trim(), notes.trim() || undefined, time, weekdays);
        if (result.status === 'denied') {
          setError('Notifications are blocked for this app — enable them in your phone settings.');
          return;
        }
        if (existing) await cancelNotificationBatch(existing.notificationIds);

        playSound('add');
        const saved = {
          id: existing?.id ?? createId(),
          title: title.trim(),
          notes: notes.trim() || undefined,
          time: time as AppData['alarms'][number]['time'],
          repeat: 'weekly' as const,
          weekdays,
          notificationIds: result.notificationIds,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        updateData((current) => ({
          ...current,
          alarms: existing
            ? current.alarms.map((alarm) => (alarm.id === existing.id ? saved : alarm))
            : [...current.alarms, saved],
        }));
        if (result.status === 'unsupported') {
          Alert.alert(
            'Saved, but not scheduled here',
            'Notifications only fire from the installed app, not this preview.',
          );
        }
      }

      resetForm();
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function deleteAlarm(id: string, notificationIds: string[]) {
    Alert.alert('Delete this alarm?', 'It will no longer notify you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelNotificationBatch(notificationIds);
          updateData((current) => ({
            ...current,
            alarms: current.alarms.filter((alarm) => alarm.id !== id),
          }));
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ALARMS</Text>
          <Text style={styles.title}>Your alarms</Text>
          <Text style={styles.subtitle}>One-off or repeating alerts — appointments, refills, anything.</Text>
        </View>
        <Button
          label={formOpen ? 'Close' : 'Add'}
          onPress={() => {
            if (formOpen) resetForm();
            setFormOpen((open) => !open);
          }}
          icon={<Ionicons name={formOpen ? 'close' : 'add'} size={18} color={COLORS.primaryInk} />}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {formOpen ? (
          <GlassCard style={styles.card}>
            <Field
              label="Name"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Hospital appointment"
              autoCapitalize="sentences"
            />
            <Field
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Bring insurance card"
            />
            <ChoiceChips
              label="Repeat"
              options={[
                { label: 'One-off date', value: 'once' },
                { label: 'Weekly', value: 'weekly' },
              ]}
              value={repeat}
              onChange={setRepeat}
            />
            {repeat === 'once' ? (
              <DateField label="Date" value={date} onChangeValue={setDate} minimumDate={new Date()} />
            ) : (
              <WeekdayPicker label="On these days" value={weekdays} onChange={setWeekdays} />
            )}
            <TimeField label="Time" value={time} onChangeValue={setTime} />
            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <Button
              label={saving ? 'Saving…' : editingId ? 'Save changes' : 'Save alarm'}
              onPress={saveAlarm}
              disabled={saving}
              icon={<Ionicons name="alarm" size={18} color={COLORS.primaryInk} />}
            />
          </GlassCard>
        ) : null}

        {upcoming.length === 0 && !formOpen ? (
          <GlassCard style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="alarm-outline" size={24} color={COLORS.accent} />
            </View>
            <Text style={styles.emptyTitle}>No alarms yet</Text>
            <Text style={styles.emptyText}>
              Add one for anything tied to a specific time — a one-off date, or a repeating weekly alert.
            </Text>
            <Button label="Add an alarm" onPress={() => setFormOpen(true)} />
          </GlassCard>
        ) : (
          upcoming.map((alarm) => (
            <GlassCard key={alarm.id} style={styles.alarmCard}>
              <View style={styles.alarmRow}>
                <View style={styles.alarmIcon}>
                  <Ionicons name={alarm.repeat === 'weekly' ? 'repeat' : 'alarm'} size={18} color={COLORS.accent} />
                </View>
                <View style={styles.alarmText}>
                  <Text style={styles.alarmTitle}>{alarm.title}</Text>
                  <Text style={styles.alarmWhen}>{describeAlarm(alarm)}</Text>
                  {alarm.notes ? <Text style={styles.alarmNotes}>{alarm.notes}</Text> : null}
                </View>
              </View>
              <View style={styles.alarmActions}>
                <View style={styles.alarmActionButton}>
                  <Button label="Edit" variant="secondary" onPress={() => openEdit(alarm)} />
                </View>
                <View style={styles.alarmActionButton}>
                  <Button
                    label="Delete"
                    variant="danger"
                    onPress={() => deleteAlarm(alarm.id, alarm.notificationIds)}
                  />
                </View>
              </View>
            </GlassCard>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  eyebrow: {
    ...TEXT.eyebrow,
  },
  title: {
    ...TEXT.h1,
    marginTop: 2,
  },
  subtitle: {
    ...TEXT.body,
    marginTop: 6,
    maxWidth: 380,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: 18,
    gap: 18,
  },
  emptyCard: {
    padding: 20,
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    ...TEXT.h2,
  },
  emptyText: {
    ...TEXT.body,
  },
  alarmCard: {
    padding: 16,
    gap: 14,
  },
  alarmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alarmIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  alarmText: {
    flex: 1,
  },
  alarmTitle: {
    ...TEXT.h2,
  },
  alarmWhen: {
    ...TEXT.caption,
    color: COLORS.accent,
    marginTop: 3,
  },
  alarmNotes: {
    ...TEXT.body,
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  alarmActionButton: {
    flex: 1,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    ...TEXT.body,
    color: COLORS.danger,
  },
});
