export type ISODate = `${number}-${number}-${number}`;
export type TimeOfDay = `${number}:${number}`;

export type MealName = 'breakfast' | 'lunch' | 'dinner';
export type MealRelation = 'before' | 'after';
export type DoseStatus = 'pending' | 'taken' | 'delayed';

export interface MealSchedule {
  id: string;
  type: 'meal';
  meal: MealName;
  relation: MealRelation;
  offsetMinutes: number;
}

export interface FixedSchedule {
  id: string;
  type: 'fixed';
  time: TimeOfDay;
}

export type MedicineSchedule = MealSchedule | FixedSchedule;

export interface Medicine {
  id: string;
  name: string;
  amount: number;
  /** Total pills on hand. endDate is derived from this and daily usage. */
  totalQuantity: number;
  startDate: ISODate;
  endDate: ISODate;
  schedules: MedicineSchedule[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MealTimes = Record<MealName, TimeOfDay>;

export interface MealOverride {
  date: ISODate;
  times: Partial<MealTimes>;
}

export interface DoseRecord {
  id: string;
  medicineId: string;
  scheduleId: string;
  date: ISODate;
  scheduledAt: string;
  status: DoseStatus;
  takenAt?: string;
  delayedUntil?: string;
  notificationId?: string;
  /** A second "you haven't responded" notification, cancelled once the dose is marked taken/delayed. */
  followUpNotificationId?: string;
}

/** 0 = Sunday ... 6 = Saturday, matching Date#getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * A reminder for a specific time — either a one-off date (e.g. "Hospital
 * appointment") or repeating on chosen weekdays (e.g. every Mon/Wed/Fri).
 */
export interface Alarm {
  id: string;
  title: string;
  notes?: string;
  time: TimeOfDay;
  repeat: 'once' | 'weekly';
  /** Set when repeat is "once". */
  date?: ISODate;
  /** Set when repeat is "weekly". */
  weekdays?: Weekday[];
  /** Scheduled OS notification id(s) — a single one for "once", a batch for "weekly" (see notifications.ts). */
  notificationIds: string[];
  createdAt: string;
}

/** A repeating "drink water" nudge, independent of any medicine. */
export interface WaterReminder {
  enabled: boolean;
  /** "interval": every N hours starting from startTime. "weekly": only on chosen weekdays at startTime. */
  mode: 'interval' | 'weekly';
  intervalHours: number;
  /** Clock time the schedule is anchored to. */
  startTime: TimeOfDay;
  /** Which days to remind on, when mode is "weekly". */
  weekdays: Weekday[];
  /** A batch of scheduled OS notification ids covering the next few days (see notifications.ts). */
  notificationIds: string[];
}

/** A simple daily "time to sleep" nudge — just a time, every day. */
export interface SleepReminder {
  enabled: boolean;
  time: TimeOfDay;
  notificationIds: string[];
}

export interface AppData {
  version: 1;
  medicines: Medicine[];
  mealDefaults: MealTimes;
  mealOverrides: Record<ISODate, MealOverride>;
  doseRecords: Record<string, DoseRecord>;
  alarms: Alarm[];
  waterReminder: WaterReminder;
  sleepReminder: SleepReminder;
  /** How long "+N min" delays a dose by, in minutes. */
  snoozeMinutes: number;
}

export interface MealTimelineItem {
  id: string;
  type: 'meal';
  meal: MealName;
  scheduledAt: Date;
  isOverridden: boolean;
}

export interface DoseTimelineItem {
  id: string;
  type: 'dose';
  medicine: Medicine;
  schedule: MedicineSchedule;
  scheduledAt: Date;
  status: DoseStatus;
}

export type TimelineItem = MealTimelineItem | DoseTimelineItem;

export type UpdateAppData = (updater: (current: AppData) => AppData) => void;
