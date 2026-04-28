import { describe, it, expect } from 'vitest';
import { validateInsightThresholdPercents } from './companyInsightThresholdsForm';

const ok = {
  purchaseWarningPct: 65,
  purchaseCriticalPct: 80,
  expenseWarningPct: 35,
  expenseCriticalPct: 50,
  netProfitWarningBelowPct: 5,
};

describe('validateInsightThresholdPercents', () => {
  it('accepts valid bands', () => {
    expect(validateInsightThresholdPercents(ok)).toBeNull();
  });

  it('rejects purchase warning >= critical', () => {
    expect(
      validateInsightThresholdPercents({
        ...ok,
        purchaseWarningPct: 80,
        purchaseCriticalPct: 65,
      }),
    ).toBe('purchaseOrder');
  });

  it('rejects expense warning >= critical', () => {
    expect(
      validateInsightThresholdPercents({
        ...ok,
        expenseWarningPct: 50,
        expenseCriticalPct: 35,
      }),
    ).toBe('expenseOrder');
  });

  it('rejects out of range', () => {
    expect(
      validateInsightThresholdPercents({
        ...ok,
        netProfitWarningBelowPct: 101,
      }),
    ).toBe('range');
  });
});
