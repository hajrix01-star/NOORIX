import { getHrAdvanceBalanceParts, getHrAdvanceTotals } from './hr-advance-balance.util';

describe('hr advance balance util', () => {
  it('computes outstanding, partial, settled, and cancelled balances', () => {
    expect(getHrAdvanceBalanceParts({ totalAmount: '1000', settledAmount: '0' })).toMatchObject({
      remainingAmount: 1000,
      settlementStatus: 'outstanding',
    });
    expect(getHrAdvanceBalanceParts({ totalAmount: '1000', settledAmount: '250' })).toMatchObject({
      remainingAmount: 750,
      settlementStatus: 'partial',
    });
    expect(getHrAdvanceBalanceParts({ totalAmount: '1000', settledAmount: '1000' })).toMatchObject({
      remainingAmount: 0,
      settlementStatus: 'settled',
    });
    expect(getHrAdvanceBalanceParts({ status: 'cancelled', totalAmount: '1000', settledAmount: '0' })).toMatchObject({
      settlementStatus: 'cancelled',
    });
  });

  it('sums active advance totals and settlement counts', () => {
    const totals = getHrAdvanceTotals([
      { totalAmount: '1000', settledAmount: '0' },
      { totalAmount: '2000', settledAmount: '750' },
      { totalAmount: '500', settledAmount: '500' },
      { totalAmount: '0', settledAmount: '0' },
      { status: 'cancelled', totalAmount: '999', settledAmount: '0' },
    ]);

    expect(totals.count).toBe(5);
    expect(totals.totalAmount).toBe(3500);
    expect(totals.settledAmount).toBe(1250);
    expect(totals.remainingAmount).toBe(2250);
    expect(totals.remainingCount).toBe(2);
    expect(totals.outstandingCount).toBe(2);
    expect(totals.partialCount).toBe(1);
  });
});
