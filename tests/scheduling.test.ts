import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_APP_DATA } from '../src/constants/defaults';
import {
  buildTimeline,
  calculateDoseTime,
  delayDose,
  isMedicineActiveOn,
  resolveMealTimes,
} from '../src/scheduling/schedule';
import type { AppData, Medicine } from '../src/types/domain';

const medicine: Medicine = {
  id: 'med-1',
  name: 'Amoxicillin',
  amount: 2,
  totalQuantity: 28,
  startDate: '2026-09-20',
  endDate: '2026-10-03',
  schedules: [
    {
      id: 'schedule-breakfast',
      type: 'meal',
      meal: 'breakfast',
      relation: 'after',
      offsetMinutes: 15,
    },
  ],
  enabled: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
};

describe('medicine scheduling', () => {
  it('calculates before and after meal offsets', () => {
    const mealTimes = { breakfast: '08:00', lunch: '13:00', dinner: '20:00' } as const;
    const before = calculateDoseTime(
      '2026-09-20',
      {
        id: 'before-breakfast',
        type: 'meal',
        meal: 'breakfast',
        relation: 'before',
        offsetMinutes: 30,
      },
      mealTimes,
    );
    const after = calculateDoseTime('2026-09-20', medicine.schedules[0], mealTimes);

    assert.equal(before.getHours(), 7);
    assert.equal(before.getMinutes(), 30);
    assert.equal(after.getHours(), 8);
    assert.equal(after.getMinutes(), 15);
  });

  it('applies only the supplied meal override', () => {
    const result = resolveMealTimes(EMPTY_APP_DATA.mealDefaults, { breakfast: '09:00' });

    assert.deepEqual(result, {
      breakfast: '09:00',
      lunch: '13:00',
      dinner: '20:00',
    });
  });

  it('uses a today-only override when building the timeline', () => {
    const data: AppData = {
      ...EMPTY_APP_DATA,
      medicines: [medicine],
      mealOverrides: {
        '2026-09-20': {
          date: '2026-09-20',
          times: { breakfast: '09:00' },
        },
      },
    };

    const dose = buildTimeline(data, '2026-09-20').find((item) => item.type === 'dose');
    assert.ok(dose);
    assert.equal(dose.scheduledAt.getHours(), 9);
    assert.equal(dose.scheduledAt.getMinutes(), 15);
  });

  it('filters disabled and out-of-range medicines', () => {
    assert.equal(isMedicineActiveOn(medicine, '2026-09-20'), true);
    assert.equal(isMedicineActiveOn(medicine, '2026-10-04'), false);
    assert.equal(isMedicineActiveOn({ ...medicine, enabled: false }, '2026-09-20'), false);
  });

  it('delays a dose by exactly 15 minutes', () => {
    const scheduledAt = new Date(2026, 8, 20, 8, 15);
    const delayed = delayDose(scheduledAt);

    assert.equal(delayed.getHours(), 8);
    assert.equal(delayed.getMinutes(), 30);
    assert.equal(scheduledAt.getMinutes(), 15);
  });
});
