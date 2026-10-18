import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * expo-notifications throws just from being imported inside Expo Go (SDK 53+
 * dropped push support there entirely) — and it throws synchronously during
 * the module's own top-level evaluation (a side-effectful push-token
 * auto-registration file), not from anything we call. That means even a
 * lazy `await import('expo-notifications')` wrapped in try/catch isn't
 * enough to contain it reliably. So: check whether we're running in Expo Go
 * *before* ever touching that import at all, and short-circuit if so.
 */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

const CHANNEL_ID = 'alarms';

async function loadNotifications() {
  if (isExpoGo()) {
    throw new Error('expo-notifications is unavailable in Expo Go — build a dev client.');
  }
  return import('expo-notifications');
}

async function ensureReady(Notifications: Awaited<ReturnType<typeof loadNotifications>>): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification.wav',
      vibrationPattern: [0, 300, 200, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  return true;
}

/** Fires a local notification a few seconds from now, so you can confirm reminders work on this device. */
export async function sendTestNotification(): Promise<'sent' | 'denied' | 'unsupported'> {
  try {
    const Notifications = await loadNotifications();
    const ready = await ensureReady(Notifications);
    if (!ready) return 'denied';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test reminder',
        body: 'This is what your reminders will look and sound like.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
        channelId: CHANNEL_ID,
      },
    });
    return 'sent';
  } catch {
    return 'unsupported';
  }
}

interface ScheduleResult {
  status: 'scheduled' | 'denied' | 'unsupported' | 'in_past';
  notificationId?: string;
}

async function scheduleAtDate(title: string, body: string | undefined, when: Date): Promise<ScheduleResult> {
  if (when.getTime() <= Date.now()) {
    return { status: 'in_past' };
  }

  try {
    const Notifications = await loadNotifications();
    const ready = await ensureReady(Notifications);
    if (!ready) return { status: 'denied' };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: body || 'Reminder',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL_ID,
      },
    });
    return { status: 'scheduled', notificationId };
  } catch {
    return { status: 'unsupported' };
  }
}

/** Schedules a sound-and-banner notification to fire at an exact future date/time. */
export async function scheduleAlarmNotification(
  title: string,
  body: string | undefined,
  when: Date,
): Promise<ScheduleResult> {
  return scheduleAtDate(title, body, when);
}

/** Cancels a single previously scheduled notification, if it still exists. Safe to call even if unsupported. */
export async function cancelAlarmNotification(notificationId: string | undefined): Promise<void> {
  if (!notificationId) return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Expo Go, permission revoked, or the notification already fired — nothing to do.
  }
}

interface DoseReminderResult {
  status: 'scheduled' | 'denied' | 'unsupported' | 'in_past';
  notificationId?: string;
  followUpNotificationId?: string;
}

/**
 * Schedules a dose reminder plus a follow-up "still haven't taken it" nudge
 * `followUpMinutes` later, in case the first one is missed/ignored. Call
 * `cancelDoseReminder` with both ids as soon as the dose is marked
 * taken/delayed to stop the follow-up from firing.
 */
export async function scheduleDoseReminder(
  medicineName: string,
  when: Date,
  followUpMinutes = 15,
): Promise<DoseReminderResult> {
  const main = await scheduleAtDate(medicineName, 'Time to take it — tap to mark as taken.', when);
  if (main.status !== 'scheduled') {
    return { status: main.status };
  }

  const followUpAt = new Date(when.getTime() + followUpMinutes * 60_000);
  const followUp = await scheduleAtDate(
    medicineName,
    "Still not marked as taken — you haven't confirmed this dose yet.",
    followUpAt,
  );

  return {
    status: 'scheduled',
    notificationId: main.notificationId,
    followUpNotificationId: followUp.status === 'scheduled' ? followUp.notificationId : undefined,
  };
}

/** Cancels both the main and follow-up notifications for a dose. Safe to call even if unsupported. */
export async function cancelDoseReminder(
  notificationId: string | undefined,
  followUpNotificationId: string | undefined,
): Promise<void> {
  await Promise.all([cancelAlarmNotification(notificationId), cancelAlarmNotification(followUpNotificationId)]);
}

interface RecurringBatchResult {
  status: 'scheduled' | 'denied' | 'unsupported';
  notificationIds: string[];
}

const REMINDER_WINDOW_DAYS = 7;

function parseStartTime(startTime: string): { hour: number; minute: number } | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!match) return undefined;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Every `intervalHours` starting from `startTime`, aligned to that clock time. */
function intervalOccurrences(startTime: { hour: number; minute: number }, intervalHours: number, windowDays: number): Date[] {
  const anchor = new Date();
  anchor.setHours(startTime.hour, startTime.minute, 0, 0);
  while (anchor.getTime() > Date.now()) {
    anchor.setTime(anchor.getTime() - intervalHours * 3600_000);
  }

  const windowEnd = Date.now() + windowDays * 24 * 3600_000;
  const occurrences: Date[] = [];
  for (let slot = anchor.getTime(); slot < windowEnd; slot += intervalHours * 3600_000) {
    if (slot > Date.now()) occurrences.push(new Date(slot));
  }
  return occurrences;
}

/** Only on the given weekdays (0=Sun..6=Sat), at `startTime`. */
function weeklyOccurrences(startTime: { hour: number; minute: number }, weekdays: number[], windowDays: number): Date[] {
  const occurrences: Date[] = [];
  const cursor = new Date();
  cursor.setHours(startTime.hour, startTime.minute, 0, 0);
  for (let day = 0; day <= windowDays; day++) {
    const candidate = new Date(cursor.getTime() + day * 24 * 3600_000);
    if (weekdays.includes(candidate.getDay()) && candidate.getTime() > Date.now()) {
      occurrences.push(candidate);
    }
  }
  return occurrences;
}

/**
 * expo-notifications' repeating trigger can't be anchored to a clock time —
 * it just fires every N seconds from whenever you call it, drifting away
 * from a chosen start time, and can't do "only these weekdays" at all. So
 * instead of one repeating trigger, this schedules every individual
 * occurrence for the next week using the same `scheduleAtDate` helper the
 * Alarms feature uses — same mechanism as a real alarm, just several of
 * them, exact to the minute and the chosen days. Shared by the water
 * reminder, sleep reminder, and weekly-repeating alarms.
 *
 * Re-call this on every app open (while enabled) to keep extending the
 * window — see App.tsx.
 */
export async function scheduleRecurringReminder(
  title: string,
  body: string,
  startTime: string,
  mode: 'interval' | 'weekly',
  intervalHours: number,
  weekdays: number[],
): Promise<RecurringBatchResult> {
  const parsed = parseStartTime(startTime);
  if (!parsed) return { status: 'unsupported', notificationIds: [] };

  const occurrences =
    mode === 'weekly'
      ? weeklyOccurrences(parsed, weekdays, REMINDER_WINDOW_DAYS)
      : intervalOccurrences(parsed, intervalHours, REMINDER_WINDOW_DAYS);

  const notificationIds: string[] = [];
  for (const when of occurrences) {
    const result = await scheduleAtDate(title, body, when);
    if (result.status === 'denied') return { status: 'denied', notificationIds: [] };
    if (result.status === 'scheduled' && result.notificationId) notificationIds.push(result.notificationId);
  }

  return { status: notificationIds.length > 0 ? 'scheduled' : 'unsupported', notificationIds };
}

export async function scheduleWaterReminderBatch(
  startTime: string,
  mode: 'interval' | 'weekly',
  intervalHours: number,
  weekdays: number[],
): Promise<RecurringBatchResult> {
  return scheduleRecurringReminder(
    'Drink some water',
    "It's been a while — stay hydrated.",
    startTime,
    mode,
    intervalHours,
    weekdays,
  );
}

export async function scheduleSleepReminderBatch(time: string): Promise<RecurringBatchResult> {
  return scheduleRecurringReminder('Time to sleep', 'Wind down and get some rest.', time, 'weekly', 1, [
    0, 1, 2, 3, 4, 5, 6,
  ]);
}

export async function scheduleWeeklyAlarm(
  title: string,
  notes: string | undefined,
  time: string,
  weekdays: number[],
): Promise<RecurringBatchResult> {
  return scheduleRecurringReminder(title, notes || 'Reminder', time, 'weekly', 1, weekdays);
}

/** Pure calculation (no scheduling) of when a recurring reminder would next fire, for display purposes. */
export function nextRecurringReminderPreview(
  startTime: string,
  mode: 'interval' | 'weekly',
  intervalHours: number,
  weekdays: number[],
): Date | undefined {
  const parsed = parseStartTime(startTime);
  if (!parsed) return undefined;
  const occurrences =
    mode === 'weekly' ? weeklyOccurrences(parsed, weekdays, 8) : intervalOccurrences(parsed, intervalHours, 1);
  return occurrences[0];
}

/** Cancels every notification id in a batch (e.g. a water reminder window). Safe to call even if unsupported or undefined. */
export async function cancelNotificationBatch(notificationIds: string[] | undefined): Promise<void> {
  await Promise.all((notificationIds ?? []).map((id) => cancelAlarmNotification(id)));
}
