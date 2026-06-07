import { describe, expect, it } from 'vitest';
import { getAdvanceBalanceParts } from './advanceBalance';

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
});
