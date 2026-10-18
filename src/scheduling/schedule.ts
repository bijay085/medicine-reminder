import type {
  AppData,
  DoseStatus,
  ISODate,
  MealName,
  MealTimes,
  Medicine,
  MedicineSchedule,
  TimelineItem,
} from '../types/domain';
import { addDays, addMinutes, combineLocalDateAndTime } from '../utils/dateTime';

const MEALS: MealName[] = ['breakfast', 'lunch', 'dinner'];

export function isMedicineActiveOn(medicine: Medicine, date: ISODate): boolean {
  return medicine.enabled && medicine.startDate <= date && medicine.endDate >= date;
}

export function resolveMealTimes(
  defaults: MealTimes,
  override?: Partial<MealTimes>,
): MealTimes {
  return { ...defaults, ...override };
}

export function calculateDoseTime(
  date: ISODate,
  schedule: MedicineSchedule,
  mealTimes: MealTimes,
): Date {
  if (schedule.type === 'fixed') {
    return combineLocalDateAndTime(date, schedule.time);
  }

  const mealTime = combineLocalDateAndTime(date, mealTimes[schedule.meal]);
  const direction = schedule.relation === 'before' ? -1 : 1;
  return addMinutes(mealTime, direction * schedule.offsetMinutes);
}

export function createDoseId(
  medicineId: string,
  scheduleId: string,
  date: ISODate,
): string {
  return `${medicineId}:${scheduleId}:${date}`;
}

export function buildTimeline(data: AppData, date: ISODate): TimelineItem[] {
  const override = data.mealOverrides[date]?.times;
  const mealTimes = resolveMealTimes(data.mealDefaults, override);

  const mealItems: TimelineItem[] = MEALS.map((meal) => ({
    id: `meal:${meal}:${date}`,
    type: 'meal',
    meal,
    scheduledAt: combineLocalDateAndTime(date, mealTimes[meal]),
    isOverridden: override?.[meal] !== undefined,
  }));

  const doseItems: TimelineItem[] = data.medicines
    .filter((medicine) => isMedicineActiveOn(medicine, date))
    .flatMap((medicine) =>
      medicine.schedules.map((schedule) => {
        const id = createDoseId(medicine.id, schedule.id, date);
        const record = data.doseRecords[id];
        const status: DoseStatus = record?.status ?? 'pending';
        const scheduledAt = record?.delayedUntil
          ? new Date(record.delayedUntil)
          : calculateDoseTime(date, schedule, mealTimes);

        return {
          id,
          type: 'dose' as const,
          medicine,
          schedule,
          scheduledAt,
          status,
        };
      }),
    );

  return [...mealItems, ...doseItems].sort(
    (first, second) => first.scheduledAt.getTime() - second.scheduledAt.getTime(),
  );
}

export function delayDose(scheduledAt: Date, minutes = 15): Date {
  if (minutes <= 0) {
    throw new Error('Delay must be greater than zero minutes.');
  }

  return addMinutes(scheduledAt, minutes);
}

/** Pills used per day: amount per dose times how many reminder times per day. */
export function dailyPillUsage(amountPerDose: number, scheduleCount: number): number {
  return amountPerDose * Math.max(scheduleCount, 1);
}

/** How many days a supply of `totalQuantity` pills lasts at the given daily usage. */
export function daysOfSupply(totalQuantity: number, dailyUsage: number): number {
  if (dailyUsage <= 0) return 0;
  return Math.max(1, Math.ceil(totalQuantity / dailyUsage));
}

/** End date derived from start date + how many days the pill supply lasts. */
export function calculateEndDate(startDate: ISODate, totalQuantity: number, dailyUsage: number): ISODate {
  return addDays(startDate, daysOfSupply(totalQuantity, dailyUsage) - 1);
}
