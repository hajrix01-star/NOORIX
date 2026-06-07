import { describe, expect, it } from 'vitest';
import { getAdvanceBalanceParts, getAdvanceTotals, normalizeAdvance } from './advanceBalance';

describe('getAdvanceBalanceParts', () => {
  it('marks unpaid advances as outstanding', () => {
    expect(getAdvanceBalanceParts({ totalAmount: '1000', settledAmount: '0' })).toMatchObject({
      totalAmountNum: 1000,
      settledAmountNum: 0,
      remainingAmount: 1000,
      settlementStatus: 'outstanding',
    });
  });

  it('calculates partial settlement balance', () => {
    expect(getAdvanceBalanceParts({ totalAmount: '2000', settledAmount: '750' })).toMatchObject({
      totalAmountNum: 2000,
      settledAmountNum: 750,
      remainingAmount: 1250,
      settlementStatus: 'partial',
    });
  });

  it('marks fully settled advances as settled', () => {
    expect(getAdvanceBalanceParts({ totalAmount: '500', settledAmount: '500' })).toMatchObject({
      remainingAmount: 0,
      settlementStatus: 'settled',
    });
  });

  it('normalizes an advance without dropping existing fields', () => {
    expect(normalizeAdvance({ id: 'adv-1', totalAmount: '900', settledAmount: '300' })).toMatchObject({
      id: 'adv-1',
      totalAmountNum: 900,
      settledAmountNum: 300,
      remainingAmount: 600,
      settlementStatus: 'partial',
    });
  });

  it('builds active advance totals and settlement counts', () => {
    const totals = getAdvanceTotals([
      normalizeAdvance({ totalAmount: '1000', settledAmount: '0' }),
      normalizeAdvance({ totalAmount: '2000', settledAmount: '750' }),
      normalizeAdvance({ totalAmount: '500', settledAmount: '500' }),
      normalizeAdvance({ status: 'cancelled', totalAmount: '999', settledAmount: '0' }),
    ]);

    expect(totals.count).toBe(4);
    expect(totals.totalAmount.toNumber()).toBe(3500);
    expect(totals.settledAmount.toNumber()).toBe(1250);
    expect(totals.remainingAmount.toNumber()).toBe(2250);
    expect(totals.outstandingCount).toBe(1);
    expect(totals.partialCount).toBe(1);
  });
});
