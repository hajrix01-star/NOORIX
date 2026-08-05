import { describe, expect, it } from 'vitest';
import { addOrdersV4CalendarDay, suggestOrdersV4DocumentDate } from './ordersV4DocumentDate.utils';

describe('Orders V4 sequential document date', () => {
  it('suggests the day after the latest document independently of today', () => {
    expect(suggestOrdersV4DocumentDate('2026-08-10T00:00:00.000Z', '2026-08-05')).toBe('2026-08-11');
  });

  it('uses Saudi today when the document type has no prior records', () => {
    expect(suggestOrdersV4DocumentDate(undefined, '2026-08-05')).toBe('2026-08-05');
  });

  it('handles month, year, and leap-day boundaries as calendar dates', () => {
    expect(addOrdersV4CalendarDay('2026-08-31')).toBe('2026-09-01');
    expect(addOrdersV4CalendarDay('2026-12-31')).toBe('2027-01-01');
    expect(addOrdersV4CalendarDay('2028-02-28')).toBe('2028-02-29');
  });

  it('falls back safely when a stored date is invalid', () => {
    expect(suggestOrdersV4DocumentDate('2026-02-31', '2026-08-05')).toBe('2026-08-05');
  });
});
