import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { monthlyAmountFromExpenseLine } from './costAccountingAppsFixedExpenseImport';

describe('monthlyAmountFromExpenseLine', () => {
  it('returns null for non-fixed kind', () => {
    expect(monthlyAmountFromExpenseLine({ kind: 'expense', referenceAmount: 100 })).toBeNull();
  });

  it('uses annual ÷ 12 when annual > 0', () => {
    const d = monthlyAmountFromExpenseLine({
      kind: 'fixed_expense',
      annualTotalAmount: 660000,
      referenceAmount: 999,
      installmentIntervalMonths: 1,
    });
    expect(d).not.toBeNull();
    expect(d!.equals(new Decimal(55000))).toBe(true);
  });

  it('uses reference ÷ interval when no annual', () => {
    const d = monthlyAmountFromExpenseLine({
      kind: 'fixed_expense',
      referenceAmount: 165000,
      installmentIntervalMonths: 3,
    });
    expect(d!.toNumber()).toBe(55000);
  });

  it('treats reference as monthly when interval missing', () => {
    const d = monthlyAmountFromExpenseLine({ kind: 'fixed_expense', referenceAmount: 4200 });
    expect(d!.toNumber()).toBe(4200);
  });
});
