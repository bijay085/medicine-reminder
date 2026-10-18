import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { exportAppData, importAppData } from '../backup';
import { Button } from '../components/Button';
import { ChoiceChips } from '../components/ChoiceChips';
import { GlassCard } from '../components/GlassCard';
import { TimeField } from '../components/TimeField';
import { WeekdayPicker } from '../components/WeekdayPicker';
import {
  cancelNotificationBatch,
  nextRecurringReminderPreview,
  scheduleSleepReminderBatch,
  scheduleWaterReminderBatch,
  sendTestNotification,
} from '../notifications';
import { COLORS, FONTS, TEXT } from '../theme';
import type { AppData, MealName, TimeOfDay, UpdateAppData, Weekday } from '../types/domain';
import { isValidTimeOfDay } from '../utils/dateTime';

interface SettingsScreenProps {
  data: AppData;
  updateData: UpdateAppData;
}

const MEALS: { name: MealName; label: string }[] = [
  { name: 'breakfast', label: 'Breakfast' },
  { name: 'lunch', label: 'Lunch' },
  { name: 'dinner', label: 'Dinner' },
];

function currentTimeOfDay(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function SettingsScreen({ data, updateData }: SettingsScreenProps) {
  const [times, setTimes] = useState<Record<MealName, string>>({ ...data.mealDefaults });
  const [message, setMessage] = useState<string>();
  const [notifBusy, setNotifBusy] = useState(false);
  const [waterBusy, setWaterBusy] = useState(false);
  const [waterStartTime, setWaterStartTime] = useState<string>(
    data.waterReminder.startTime || currentTimeOfDay(),
  );

  function save() {
    if (!MEALS.every(({ name }) => isValidTimeOfDay(times[name]))) {
      setMessage('Enter a valid time for each meal.');
      return;
    }
    updateData((current) => ({
      ...current,
      mealDefaults: times as Record<MealName, TimeOfDay>,
    }));
    setMessage('Default meal times saved.');
  }

  function setSnoozeMinutes(minutes: number) {
    updateData((current) => ({ ...current, snoozeMinutes: minutes }));
  }

  async function testNotification() {
    setNotifBusy(true);
    try {
      const result = await sendTestNotification();
      if (result === 'sent') {
        Alert.alert('Sent', 'A test notification will arrive in about 5 seconds.');
      } else if (result === 'denied') {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications for this app in your phone settings, then try again.',
        );
      } else {
        Alert.alert(
          'Not available here',
          'Notifications only work in the installed app, not in this Expo Go preview. Build the APK to test them.',
        );
      }
    } finally {
      setNotifBusy(false);
    }
  }

  /** Cancels whatever's currently scheduled and re-schedules the next week from scratch. */
  async function rescheduleWater(overrides: {
    mode?: 'interval' | 'weekly';
    intervalHours?: number;
    startTime?: string;
    weekdays?: Weekday[];
  }) {
    const mode = overrides.mode ?? data.waterReminder.mode;
    const intervalHours = overrides.intervalHours ?? data.waterReminder.intervalHours;
    const startTime = overrides.startTime ?? waterStartTime;
    const weekdays = overrides.weekdays ?? data.waterReminder.weekdays;

    setWaterBusy(true);
    try {
      await cancelNotificationBatch(data.waterReminder.notificationIds);

      if (mode === 'weekly' && weekdays.length === 0) {
        updateData((current) => ({
          ...current,
          waterReminder: { ...current.waterReminder, enabled: true, mode, startTime: startTime as TimeOfDay, weekdays, notificationIds: [] },
        }));
        return;
      }

      const result = await scheduleWaterReminderBatch(startTime, mode, intervalHours, weekdays);

      if (result.status === 'denied') {
        Alert.alert('Notifications blocked', 'Enable notifications for this app in your phone settings.');
        updateData((current) => ({
          ...current,
          waterReminder: { ...current.waterReminder, enabled: false, notificationIds: [] },
        }));
        return;
      }
      if (result.status === 'unsupported') {
        Alert.alert(
          'Saved, but not scheduled here',
          'Notifications only fire from the installed app, not this preview.',
        );
      }

      updateData((current) => ({
        ...current,
        waterReminder: {
          ...current.waterReminder,
          enabled: true,
          mode,
          intervalHours,
          startTime: startTime as TimeOfDay,
          weekdays,
          notificationIds: result.notificationIds,
        },
      }));
    } finally {
      setWaterBusy(false);
    }
  }

  async function setWaterEnabled(enabled: boolean) {
    if (!enabled) {
      setWaterBusy(true);
      try {
        await cancelNotificationBatch(data.waterReminder.notificationIds);
        updateData((current) => ({
          ...current,
          waterReminder: { ...current.waterReminder, enabled: false, notificationIds: [] },
        }));
      } finally {
        setWaterBusy(false);
      }
      return;
    }
    await rescheduleWater({});
  }

  function toggleWeekday(next: Weekday[]) {
    rescheduleWater({ mode: 'weekly', weekdays: next });
  }

  const nextWaterReminder = useMemo(() => {
    if (!data.waterReminder.enabled) return undefined;
    return nextRecurringReminderPreview(
      waterStartTime,
      data.waterReminder.mode,
      data.waterReminder.intervalHours,
      data.waterReminder.weekdays,
    );
  }, [data.waterReminder, waterStartTime]);

  const [sleepBusy, setSleepBusy] = useState(false);
  const [sleepTime, setSleepTime] = useState<string>(data.sleepReminder.time || '22:00');

  async function setSleepEnabled(enabled: boolean) {
    setSleepBusy(true);
    try {
      await cancelNotificationBatch(data.sleepReminder.notificationIds);
      if (!enabled) {
        updateData((current) => ({
          ...current,
          sleepReminder: { ...current.sleepReminder, enabled: false, notificationIds: [] },
        }));
        return;
      }
      const result = await scheduleSleepReminderBatch(sleepTime);
      if (result.status === 'denied') {
        Alert.alert('Notifications blocked', 'Enable notifications for this app in your phone settings.');
        return;
      }
      if (result.status === 'unsupported') {
        Alert.alert(
          'Saved, but not scheduled here',
          'Notifications only fire from the installed app, not this preview.',
        );
      }
      updateData((current) => ({
        ...current,
        sleepReminder: { enabled: true, time: sleepTime as TimeOfDay, notificationIds: result.notificationIds },
      }));
    } finally {
      setSleepBusy(false);
    }
  }

  async function changeSleepTime(time: string) {
    setSleepTime(time);
    if (!data.sleepReminder.enabled) return;
    setSleepBusy(true);
    try {
      await cancelNotificationBatch(data.sleepReminder.notificationIds);
      const result = await scheduleSleepReminderBatch(time);
      updateData((current) => ({
        ...current,
        sleepReminder: {
          enabled: true,
          time: time as TimeOfDay,
          notificationIds: result.status === 'scheduled' ? result.notificationIds : [],
        },
      }));
    } finally {
      setSleepBusy(false);
    }
  }

  const nextSleepReminder = useMemo(() => {
    if (!data.sleepReminder.enabled) return undefined;
    return nextRecurringReminderPreview(sleepTime, 'weekly', 1, [0, 1, 2, 3, 4, 5, 6]);
  }, [data.sleepReminder.enabled, sleepTime]);

  const [backupBusy, setBackupBusy] = useState(false);

  async function handleExport() {
    setBackupBusy(true);
    try {
      const result = await exportAppData(data);
      if (result === 'unsupported') {
        Alert.alert('Not available', "Sharing isn't available on this device.");
      } else if (result === 'error') {
        Alert.alert('Export failed', 'Something went wrong creating the backup file.');
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImport() {
    Alert.alert(
      'Replace all data?',
      'Importing a backup replaces everything currently on this device — medicines, alarms, history, settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            setBackupBusy(true);
            try {
              // Best-effort: clear the water/sleep/alarm batches this device
              // currently has scheduled before swapping the data out from
              // under them, so nothing stale fires later with old content.
              await Promise.all([
                cancelNotificationBatch(data.waterReminder.notificationIds),
                cancelNotificationBatch(data.sleepReminder.notificationIds),
                ...data.alarms.map((alarm) => cancelNotificationBatch(alarm.notificationIds)),
              ]);

              const result = await importAppData();
              if (result.status === 'imported') {
                updateData(() => result.data);
                Alert.alert('Imported', 'Your backup has been restored.');
              } else if (result.status === 'invalid') {
                Alert.alert('Invalid file', "That doesn't look like a Medicine Reminder backup.");
              } else if (result.status === 'error') {
                Alert.alert('Import failed', 'Something went wrong reading that file.');
              }
            } finally {
              setBackupBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SETTINGS</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Meal times, hydration, and notifications.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <GlassCard style={styles.card}>
          <Text style={styles.cardHeading}>Default meal times</Text>
          {MEALS.map(({ name, label }) => (
            <TimeField
              key={name}
              label={label}
              value={times[name]}
              onChangeValue={(value) => {
                setMessage(undefined);
                setTimes((current) => ({ ...current, [name]: value }));
              }}
            />
          ))}
          {message ? (
            <View
              accessibilityRole="alert"
              style={message.endsWith('saved.') ? styles.successBox : styles.errorBox}
            >
              <Text style={message.endsWith('saved.') ? styles.successText : styles.errorText}>
                {message}
              </Text>
            </View>
          ) : null}
          <Button
            label="Save default times"
            onPress={save}
            icon={<Ionicons name="checkmark" size={18} color={COLORS.primaryInk} />}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardHeading}>Snooze duration</Text>
          <ChoiceChips
            label={'"+N min" delays a dose by'}
            options={[
              { label: '5 min', value: 5 },
              { label: '10 min', value: 10 },
              { label: '15 min', value: 15 },
              { label: '30 min', value: 30 },
            ]}
            value={data.snoozeMinutes}
            onChange={setSnoozeMinutes}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="water-outline" size={20} color={COLORS.accent} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Water reminder</Text>
              <Text style={styles.infoText}>
                {!data.waterReminder.enabled
                  ? 'A nudge to drink water, independent of your medicines.'
                  : nextWaterReminder
                    ? `Next: ${new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(nextWaterReminder)}`
                    : 'Pick at least one day below.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Enable water reminder"
              value={data.waterReminder.enabled}
              disabled={waterBusy}
              onValueChange={setWaterEnabled}
              trackColor={{ false: '#4A466B', true: '#33DCB6' }}
              thumbColor={data.waterReminder.enabled ? COLORS.primary : '#EDEBFA'}
            />
          </View>
          {data.waterReminder.enabled ? (
            <>
              <ChoiceChips
                label="Schedule"
                options={[
                  { label: 'Every N hours', value: 'interval' },
                  { label: 'Specific days', value: 'weekly' },
                ]}
                value={data.waterReminder.mode}
                onChange={(value) => rescheduleWater({ mode: value })}
              />
              <TimeField
                label="Start time"
                value={waterStartTime}
                onChangeValue={(value) => {
                  setWaterStartTime(value);
                  rescheduleWater({ startTime: value });
                }}
              />
              {data.waterReminder.mode === 'interval' ? (
                <ChoiceChips
                  label="Then every"
                  options={[
                    { label: '1 hour', value: 1 },
                    { label: '2 hours', value: 2 },
                    { label: '3 hours', value: 3 },
                    { label: '4 hours', value: 4 },
                  ]}
                  value={data.waterReminder.intervalHours}
                  onChange={(value) => rescheduleWater({ intervalHours: value })}
                />
              ) : (
                <WeekdayPicker label="On these days" value={data.waterReminder.weekdays} onChange={toggleWeekday} />
              )}
            </>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="moon-outline" size={20} color={COLORS.accent} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Sleep reminder</Text>
              <Text style={styles.infoText}>
                {!data.sleepReminder.enabled
                  ? 'A daily nudge that it\'s time to sleep.'
                  : nextSleepReminder
                    ? `Next: ${new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(nextSleepReminder)}`
                    : 'Pick a time below.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Enable sleep reminder"
              value={data.sleepReminder.enabled}
              disabled={sleepBusy}
              onValueChange={setSleepEnabled}
              trackColor={{ false: '#4A466B', true: '#33DCB6' }}
              thumbColor={data.sleepReminder.enabled ? COLORS.primary : '#EDEBFA'}
            />
          </View>
          {data.sleepReminder.enabled ? (
            <TimeField label="Time" value={sleepTime} onChangeValue={changeSleepTime} />
          ) : null}
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.accent} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Notifications</Text>
              <Text style={styles.infoText}>Send a test alert to confirm reminders work on this phone.</Text>
            </View>
          </View>
          <Button
            label={notifBusy ? 'Sending…' : 'Send test notification'}
            variant="secondary"
            disabled={notifBusy}
            onPress={testNotification}
            icon={<Ionicons name="notifications" size={18} color={COLORS.ink} />}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="alarm-outline" size={20} color={COLORS.warning} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>If reminders arrive late or not at all</Text>
              <Text style={styles.infoText}>
                A 5-second test always fires, but reminders hours away can get silently delayed or
                dropped by Android's battery saver. Fix it once: open this app's settings, allow
                "Alarms & reminders", and set battery usage to "Unrestricted".
              </Text>
            </View>
          </View>
          <Button
            label="Open app settings"
            variant="secondary"
            onPress={() => Linking.openSettings()}
            icon={<Ionicons name="settings-outline" size={18} color={COLORS.ink} />}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardHeading}>Backup</Text>
          <Text style={styles.infoText}>
            Since nothing leaves this device, back up to a file every so often — or before switching
            phones.
          </Text>
          <Button
            label="Export data"
            variant="secondary"
            disabled={backupBusy}
            onPress={handleExport}
            icon={<Ionicons name="download-outline" size={18} color={COLORS.ink} />}
          />
          <Button
            label="Import data"
            variant="danger"
            disabled={backupBusy}
            onPress={handleImport}
            icon={<Ionicons name="cloud-upload-outline" size={18} color={COLORS.danger} />}
          />
        </GlassCard>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.accent} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Stored on this device</Text>
            <Text style={styles.infoText}>
              Medicines, meal times, and dose status stay local. There is no account or cloud sync.
            </Text>
          </View>
        </View>

        <Text style={styles.versionText}>Medicine Reminder · v1.0.0</Text>
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
    maxWidth: 520,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 16,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: {
    padding: 20,
    gap: 20,
  },
  cardHeading: {
    ...TEXT.h2,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    ...TEXT.h3,
    color: COLORS.accent,
  },
  infoText: {
    ...TEXT.body,
    marginTop: 4,
  },
  successBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 10,
    padding: 11,
  },
  successText: {
    ...TEXT.caption,
    color: COLORS.primary,
    fontFamily: FONTS.bodyBold,
  },
  errorBox: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    padding: 11,
  },
  errorText: {
    ...TEXT.caption,
    color: COLORS.danger,
    fontFamily: FONTS.bodyBold,
  },
  versionText: {
    ...TEXT.caption,
    textAlign: 'center',
    marginTop: 4,
  },
});
