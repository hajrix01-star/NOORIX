import { describe, expect, it } from 'vitest';
import {
  computeAppShare,
  computeAppShareFromSummaries,
  computeDayAppShare,
  computeShiftAppShare,
  monthRangeForYmd,
} from './salesAppShare';

describe('salesAppShare', () => {
  it('computes app share from channels by vault type', () => {
    const share = computeAppShare(
      [
        { amount: 300, vault: { type: 'app', nameAr: 'جاهز' } },
        { amount: 700, vault: { type: 'bank', nameAr: 'بنك' } },
      ],
      1000,
    );
    expect(share.appAmount).toBe(300);
    expect(share.appPercent).toBe(30);
  });

  it('aggregates month range and shift/day shares', () => {
    const summaries = [
      {
        status: 'active',
        transactionDate: '2025-04-15',
        shift: 'morning',
        totalAmount: 1000,
        channels: [
          { amount: 200, vault: { type: 'app', nameAr: 'جاهز' } },
          { amount: 800, vault: { type: 'cash', nameAr: 'نقدي' } },
        ],
      },
      {
        status: 'active',
        transactionDate: '2025-04-15',
        shift: 'evening',
        totalAmount: 500,
        channels: [{ amount: 100, vault: { type: 'app', nameAr: 'هنقر' } }],
      },
      {
        status: 'cancelled',
        transactionDate: '2025-04-15',
        shift: 'morning',
        totalAmount: 999,
        channels: [{ amount: 999, vault: { type: 'app', nameAr: 'ملغى' } }],
      },
    ];

    expect(computeShiftAppShare(summaries, '2025-04-15', 'morning').appPercent).toBe(20);
    expect(computeDayAppShare(summaries, '2025-04-15').appPercent).toBeCloseTo((300 / 1500) * 100, 5);
    expect(computeAppShareFromSummaries(summaries).appPercent).toBeCloseTo((300 / 1500) * 100, 5);
    expect(monthRangeForYmd('2025-04-15')).toEqual({ start: '2025-04-01', end: '2025-04-30' });
  });
});
