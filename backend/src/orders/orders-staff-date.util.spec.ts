import { parseSaleDateYmd, staffOrderDayKey } from './orders-staff-date.util';

describe('orders staff date helpers', () => {
  it('parses staff sale dates as UTC date-only values', () => {
    expect(parseSaleDateYmd('2026-06-29').toISOString()).toBe('2026-06-29T00:00:00.000Z');
  });

  it('rejects invalid staff sale date strings', () => {
    expect(() => parseSaleDateYmd('29-06-2026')).toThrow();
  });

  it('uses saleDate before createdAt for day grouping', () => {
    expect(
      staffOrderDayKey({
        saleDate: new Date(Date.UTC(2026, 5, 29)),
        createdAt: new Date(Date.UTC(2026, 5, 28)),
      }),
    ).toBe('2026-06-29');
  });
});
