import { describe, expect, it } from 'vitest';
import { v4ReportNumber, v4UserLabel } from './OrdersV4Shared';

describe('OrdersV4 display helpers', () => {
  it('rounds report display values to one decimal without changing the source value', () => {
    const source = '12.345678';
    expect(v4ReportNumber(source)).toBe('12.3');
    expect(source).toBe('12.345678');
  });

  it('shows employee name beside the username without an email domain', () => {
    expect(v4UserLabel({ id: 'u1', nameAr: 'أحمد', username: 'ahmed' })).toBe('أحمد (ahmed)');
    expect(v4UserLabel({ id: 'u2', username: 'cashier' })).toBe('cashier');
  });
});
