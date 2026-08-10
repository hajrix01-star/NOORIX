import { describe, expect, it } from 'vitest';
import { ordersV4StaffDocumentDateRange } from './ordersV4DocumentDate.utils';

describe('Orders V4 staff document date range', () => {
  it('allows today, the previous nine days, and tomorrow only', () => {
    expect(ordersV4StaffDocumentDateRange('2026-08-05')).toEqual({ min: '2026-07-27', max: '2026-08-06' });
  });
});