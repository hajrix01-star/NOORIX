import { describe, expect, it } from 'vitest';
import { buildGroupedAdvanceRows, type AdvanceRow } from './advanceGrouping';

describe('buildGroupedAdvanceRows', () => {
  it('groups advances by employee and derives settlement status', () => {
    const rows: AdvanceRow[] = [
      {
        id: 'a1',
        employeeId: 'e1',
        employeeName: 'Ali',
        totalAmountNum: 100,
        settledAmountNum: 40,
        remainingAmount: 60,
        transactionDate: '2026-06-01',
        settlementStatus: 'partial',
      },
      {
        id: 'a2',
        employeeId: 'e1',
        employeeName: 'Ali',
        totalAmountNum: 50,
        settledAmountNum: 0,
        remainingAmount: 50,
        transactionDate: '2026-06-10',
        settlementStatus: 'outstanding',
      },
      {
        id: 'a3',
        employeeId: 'e2',
        employeeName: 'Sara',
        totalAmountNum: 20,
        settledAmountNum: 20,
        remainingAmount: 0,
        transactionDate: '2026-06-05',
        settlementStatus: 'settled',
      },
      {
        id: 'd1',
        employeeId: 'e1',
        employeeName: 'Ali',
        recordType: 'deduction',
        totalAmountNum: 25,
        settledAmountNum: 25,
        remainingAmount: 0,
        transactionDate: '2026-06-11',
        settlementStatus: 'settled',
      },
    ];

    const result = buildGroupedAdvanceRows(rows, 'transactionDate', 'desc', 'en');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      employeeId: 'e1',
      totalAmount: 150,
      settledAmountNum: 40,
      remainingAmount: 110,
      transactionDate: '2026-06-11',
      advanceCount: 2,
      deductionCount: 1,
      manualDeductionAmount: 25,
      outstandingCount: 1,
      partialCount: 1,
      settledCount: 0,
      settlementStatus: 'partial',
    });
    expect(result[1]).toMatchObject({
      employeeId: 'e2',
      settlementStatus: 'settled',
    });
  });
});
