import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import {
  ruleFixedExpensePressure,
  ruleMissingExpenseCategory,
  ruleTopExpenseCategoryShare,
  ruleUnusualExpenseSpike,
} from './expense-insights.rules';

function baseGroup(
  key: 'sales' | 'expenses',
  months: string[],
  items: GeneralProfitLossModel['groups'][0]['items'],
): GeneralProfitLossModel['groups'][0] {
  return {
    key,
    labelAr: key,
    labelEn: key,
    months,
    total: '0',
    percentOfSalesMonths: months.map(() => '0'),
    percentOfSalesYear: '0',
    items,
  };
}

function plExpense(
  expenseMonths: string[],
  salesMonths: string[],
  items: GeneralProfitLossModel['groups'][0]['items'],
  extraGroups: GeneralProfitLossModel['groups'][0][] = [],
): GeneralProfitLossModel {
  return {
    months: [],
    groups: [baseGroup('sales', salesMonths, []), baseGroup('expenses', expenseMonths, items), ...extraGroups],
    summaryRows: [],
    cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
  };
}

describe('expense-insights.rules', () => {
  describe('ruleTopExpenseCategoryShare', () => {
    it('emits warning when top category share >= 0.40 and < 0.55', () => {
      const items = [
        {
          key: 'category:a',
          labelAr: 'A',
          labelEn: 'A',
          months: Array.from({ length: 12 }, (_, i) => (i === 2 ? '45' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
        {
          key: 'category:b',
          labelAr: 'B',
          labelEn: 'B',
          months: Array.from({ length: 12 }, (_, i) => (i === 2 ? '50' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const salesMonths = Array(12).fill('200');
      const expMonths = Array(12).fill('0');
      expMonths[2] = '100';
      const pl = plExpense(expMonths, salesMonths, items);
      const w = ruleTopExpenseCategoryShare(pl, 3);
      expect(w).not.toBeNull();
      expect(w!.severity).toBe('warning');
      expect(w!.id).toBe('top_expense_category_share_warning');
      expect(w!.values).toMatchObject({ share: 0.5, totalExpenses: 100 });
    });

    it('emits critical when share >= 0.55', () => {
      const items = [
        {
          key: 'category:a',
          labelAr: 'A',
          labelEn: 'A',
          months: Array.from({ length: 12 }, (_, i) => (i === 5 ? '60' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
        {
          key: 'category:b',
          labelAr: 'B',
          labelEn: 'B',
          months: Array.from({ length: 12 }, (_, i) => (i === 5 ? '40' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const expMonths = Array(12).fill('0');
      expMonths[5] = '100';
      const pl = plExpense(expMonths, Array(12).fill('1000'), items);
      const w = ruleTopExpenseCategoryShare(pl, 6);
      expect(w!.severity).toBe('critical');
    });
  });

  describe('ruleMissingExpenseCategory', () => {
    it('emits when kind/account buckets exceed threshold', () => {
      const items = [
        {
          key: 'kind:expense',
          labelAr: 'Var',
          labelEn: 'Var',
          months: Array.from({ length: 12 }, (_, i) => (i === 1 ? '25' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
        {
          key: 'category:a',
          labelAr: 'A',
          labelEn: 'A',
          months: Array.from({ length: 12 }, (_, i) => (i === 1 ? '75' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const expMonths = Array(12).fill('0');
      expMonths[1] = '100';
      const pl = plExpense(expMonths, Array(12).fill('500'), items);
      const w = ruleMissingExpenseCategory(pl, 2);
      expect(w).not.toBeNull();
      expect(w!.id).toBe('missing_expense_category_warning');
      expect(w!.values).toMatchObject({ uncategorizedShare: 0.25, thresholdWarning: 0.2 });
    });
  });

  describe('ruleUnusualExpenseSpike', () => {
    it('fires with enough prior history', () => {
      const exp = Array(12).fill('0');
      exp[1] = '10';
      exp[2] = '10';
      exp[3] = '100';
      const pl = plExpense(exp, Array(12).fill('1000'), []);
      const w = ruleUnusualExpenseSpike(pl, 4);
      expect(w).not.toBeNull();
      expect(w!.id).toBe('unusual_expense_spike_warning');
    });

    it('does not fire with insufficient valid prior months', () => {
      const exp = Array(12).fill('');
      exp[0] = '10';
      exp[3] = '500';
      const pl = plExpense(exp, Array(12).fill('1000'), []);
      expect(ruleUnusualExpenseSpike(pl, 4)).toBeNull();
    });
  });

  describe('ruleFixedExpensePressure', () => {
    it('emits warning when fixed/sales crosses 0.25', () => {
      const items = [
        {
          key: 'kind:fixed_expense',
          labelAr: 'F',
          labelEn: 'F',
          months: Array.from({ length: 12 }, (_, i) => (i === 4 ? '30' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const sales = Array(12).fill('0');
      sales[4] = '100';
      const exp = Array(12).fill('0');
      exp[4] = '100';
      const pl = plExpense(exp, sales, items);
      const w = ruleFixedExpensePressure(pl, 5);
      expect(w).not.toBeNull();
      expect(w!.severity).toBe('warning');
      expect(w!.values).toMatchObject({ fixedToSales: 0.3 });
    });

    it('emits critical when fixed/sales >= 0.35', () => {
      const items = [
        {
          key: 'kind:fixed_expense',
          labelAr: 'F',
          labelEn: 'F',
          months: Array.from({ length: 12 }, (_, i) => (i === 0 ? '40' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const sales = Array(12).fill('0');
      sales[0] = '100';
      const exp = Array(12).fill('0');
      exp[0] = '100';
      const pl = plExpense(exp, sales, items);
      const w = ruleFixedExpensePressure(pl, 1);
      expect(w!.severity).toBe('critical');
    });

    it('does not fire when fixed row absent', () => {
      const pl = plExpense(Array(12).fill('100'), Array(12).fill('1000'), []);
      expect(ruleFixedExpensePressure(pl, 6)).toBeNull();
    });

    it('does not fire when sales near zero', () => {
      const items = [
        {
          key: 'kind:fixed_expense',
          labelAr: 'F',
          labelEn: 'F',
          months: Array.from({ length: 12 }, (_, i) => (i === 2 ? '50' : '0')),
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
        },
      ];
      const sales = Array(12).fill('0');
      const exp = Array(12).fill('0');
      exp[2] = '50';
      const pl = plExpense(exp, sales, items);
      expect(ruleFixedExpensePressure(pl, 3)).toBeNull();
    });
  });
});
