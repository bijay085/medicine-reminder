import type { AppData, MealTimes } from '../types/domain';

export const DEFAULT_MEAL_TIMES: MealTimes = {
  breakfast: '08:00',
  lunch: '13:00',
  dinner: '20:00',
};

export const EMPTY_APP_DATA: AppData = {
  version: 1,
  medicines: [],
  mealDefaults: DEFAULT_MEAL_TIMES,
  mealOverrides: {},
  doseRecords: {},
  alarms: [],
  waterReminder: {
    enabled: false,
    mode: 'interval',
    intervalHours: 2,
    startTime: '08:00',
    weekdays: [1, 2, 3, 4, 5],
    notificationIds: [],
  },
  sleepReminder: {
    enabled: false,
    time: '22:00',
    notificationIds: [],
  },
  snoozeMinutes: 15,
};
