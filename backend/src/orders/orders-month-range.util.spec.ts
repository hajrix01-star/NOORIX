import { utcBoundsForGregorianMonth } from './orders-month-range.util';

describe('utcBoundsForGregorianMonth', () => {
  it('يناير 2025 من بداية الشهر لنهايته', () => {
    const { start, end } = utcBoundsForGregorianMonth(2025, 1);
    expect(start.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(end.getUTCDate()).toBe(31);
  });
});
