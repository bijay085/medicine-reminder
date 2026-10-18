import type { ISODate, TimeOfDay } from '../types/domain';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeOfDay(value: string): value is TimeOfDay {
  return TIME_PATTERN.test(value);
}

export function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function formatISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODate;
}

export function combineLocalDateAndTime(date: ISODate, time: TimeOfDay): Date {
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }

  const timeMatch = TIME_PATTERN.exec(time);
  if (!timeMatch) {
    throw new Error(`Invalid time of day: ${time}`);
  }

  const [year, month, day] = date.split('-').map(Number);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: ISODate, days: number): ISODate {
  const result = combineLocalDateAndTime(date, '12:00');
  result.setDate(result.getDate() + days);
  return formatISODate(result);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export type Meridiem = 'AM' | 'PM';

/** Splits a 24-hour "HH:mm" TimeOfDay into 12-hour parts for input UI. */
export function to12Hour(time: string): { hour: string; minute: string; meridiem: Meridiem } {
  const match = TIME_PATTERN.exec(time);
  if (!match) return { hour: '', minute: '', meridiem: 'AM' };
  const hour24 = Number(match[1]);
  const minute = match[2];
  const meridiem: Meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour: String(hour12), minute, meridiem };
}

/** Combines 12-hour input parts back into a 24-hour "HH:mm" TimeOfDay string, or undefined if invalid. */
export function from12Hour(hour: string, minute: string, meridiem: Meridiem): TimeOfDay | undefined {
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  if (!Number.isInteger(hourNum) || hourNum < 1 || hourNum > 12) return undefined;
  if (!Number.isInteger(minuteNum) || minuteNum < 0 || minuteNum > 59) return undefined;
  let hour24 = hourNum % 12;
  if (meridiem === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(minuteNum).padStart(2, '0')}` as TimeOfDay;
}
