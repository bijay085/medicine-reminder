import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_APP_DATA } from '../constants/defaults';
import type { Alarm } from '../types/domain';
import type { AppData } from '../types/domain';
import { formatISODate } from '../utils/dateTime';

const STORAGE_KEY = '@medicine-reminder/app-data';

/** Older saved alarms had a single `dateTime` + `notificationId` instead of the current `time`/`repeat`/`notificationIds` shape. */
function migrateAlarm(raw: unknown): Alarm | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.repeat === 'string' && Array.isArray(candidate.notificationIds)) {
    return candidate as unknown as Alarm;
  }
  // Old shape: { dateTime: string, notificationId?: string, ... }
  if (typeof candidate.dateTime === 'string') {
    const when = new Date(candidate.dateTime);
    if (Number.isNaN(when.getTime())) return undefined;
    return {
      id: typeof candidate.id === 'string' ? candidate.id : `alarm-${Date.now()}`,
      title: typeof candidate.title === 'string' ? candidate.title : 'Reminder',
      notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
      time: `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}` as Alarm['time'],
      repeat: 'once',
      date: formatISODate(when),
      notificationIds:
        typeof candidate.notificationId === 'string' ? [candidate.notificationId] : [],
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    };
  }
  return undefined;
}

function createEmptyData(): AppData {
  return {
    ...EMPTY_APP_DATA,
    mealDefaults: { ...EMPTY_APP_DATA.mealDefaults },
    medicines: [],
    mealOverrides: {},
    doseRecords: {},
  };
}

/**
 * Turns arbitrary parsed JSON into a valid AppData, filling in anything
 * missing/stale with defaults. Shared by normal load-from-disk and by
 * importing a backup file (see backup.ts) — same tolerance for old shapes
 * either way, and imported notification ids are always dropped since they
 * were scheduled on a different device/session and won't mean anything here;
 * the app's own refresh-on-open effects will reschedule everything fresh.
 */
export function parseAppData(raw: unknown, options?: { dropNotificationIds?: boolean }): AppData | undefined {
  if (!raw || typeof raw !== 'object' || !('version' in raw)) return undefined;

  const candidate = raw as Partial<AppData>;
  if (candidate.version !== 1) return undefined;

  const drop = options?.dropNotificationIds ?? false;
  const doseRecords = candidate.doseRecords ?? {};

  return {
    ...createEmptyData(),
    ...candidate,
    mealDefaults: {
      ...EMPTY_APP_DATA.mealDefaults,
      ...candidate.mealDefaults,
    },
    medicines: candidate.medicines ?? [],
    mealOverrides: candidate.mealOverrides ?? {},
    doseRecords: drop
      ? Object.fromEntries(
          Object.entries(doseRecords).map(([id, record]) => [
            id,
            { ...record, notificationId: undefined, followUpNotificationId: undefined },
          ]),
        )
      : doseRecords,
    alarms: Array.isArray(candidate.alarms)
      ? (candidate.alarms as unknown[])
          .map(migrateAlarm)
          .filter((alarm): alarm is Alarm => alarm !== undefined)
          .map((alarm) => (drop ? { ...alarm, notificationIds: [] } : alarm))
      : [],
    // Merge field-by-field, not just `?? default` — older saved data had a
    // different shape here (a single `notificationId` instead of the
    // `notificationIds` array), and a shallow `??` would keep that stale
    // shape wholesale, leaving `notificationIds` undefined and crashing
    // anything that calls `.map`/`.forEach` on it.
    waterReminder: {
      ...EMPTY_APP_DATA.waterReminder,
      ...candidate.waterReminder,
      notificationIds:
        !drop && Array.isArray(candidate.waterReminder?.notificationIds)
          ? candidate.waterReminder.notificationIds
          : [],
    },
    sleepReminder: {
      ...EMPTY_APP_DATA.sleepReminder,
      ...candidate.sleepReminder,
      notificationIds:
        !drop && Array.isArray(candidate.sleepReminder?.notificationIds)
          ? candidate.sleepReminder.notificationIds
          : [],
    },
    snoozeMinutes:
      typeof candidate.snoozeMinutes === 'number' ? candidate.snoozeMinutes : EMPTY_APP_DATA.snoozeMinutes,
    version: 1,
  };
}

export async function loadAppData(): Promise<AppData> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return createEmptyData();
  }

  try {
    const parsed = parseAppData(JSON.parse(stored));
    return parsed ?? createEmptyData();
  } catch {
    return createEmptyData();
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearAppData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
