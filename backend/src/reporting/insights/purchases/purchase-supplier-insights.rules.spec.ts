import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { GENERAL_PNL_AMOUNT_BASIS } from '../../../reports/reports-pl-contract.util';
import {
  ruleMissingSupplierBreakdown,
  rulePurchaseCategoryConcentration,
  rulePurchaseCategorySpike,
  rulePurchaseUncategorizedShare,
  type PurchaseCategoryBreakdownRow,
  type SupplierCategoryBreakdownRow,
} from './purchase-supplier-insights.rules';

function monthsTemplate(fill: string): string[] {
  return Array.from({ length: 12 }, () => fill);
}

function plPurchasesCategory(monthsByCat: Record<string, string[]>): GeneralProfitLossModel {
  const items = Object.entries(monthsByCat).map(([id, months]) => ({
    key: `category:${id}`,
    labelAr: `Cat-${id}`,
    labelEn: `Cat-${id}`,
    months,
    total: '0',
    percentOfSalesMonths: months.map(() => '0'),
    percentOfSalesYear: '0',
  }));
  return {
    amountBasis: GENERAL_PNL_AMOUNT_BASIS,
    months: [],
    groups: [
      {
        key: 'purchases',
        labelAr: 'م',
        labelEn: 'P',
        months: monthsTemplate('0'),
        total: '0',
        percentOfSalesMonths: monthsTemplate('0'),
        percentOfSalesYear: '0',
        items,
      },
    ],
    summaryRows: [],
    cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
  };
}

describe('purchase-supplier-insights.rules', () => {
  describe('rulePurchaseCategoryConcentration', () => {
    it('emits warning when top categorized share >= 0.50 and < 0.65', () => {
      const breakdown: PurchaseCategoryBreakdownRow[] = [
        { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '55.0000' },
        { categoryId: 'b', nameAr: 'B', nameEn: 'B', amount: '45.0000' },
      ];
      const w = rulePurchaseCategoryConcentration(breakdown, '100.0000');
      expect(w).not.toBeNull();
      expect(w!.severity).toBe('warning');
      expect(w!.id).toBe('purchase_category_concentration_warning');
      expect(w!.values).toMatchObject({
        topCategoryId: 'a',
        topShare: 0.55,
        thresholdWarning: 0.5,
        thresholdCritical: 0.65,
      });
    });

    it('emits critical when top categorized share >= 0.65', () => {
      const breakdown: PurchaseCategoryBreakdownRow[] = [
        { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '70.0000' },
        { categoryId: 'b', nameAr: 'B', nameEn: 'B', amount: '30.0000' },
      ];
      const w = rulePurchaseCategoryConcentration(breakdown, '100.0000');
      expect(w!.severity).toBe('critical');
    });

    it('does not let uncategorized win concentration', () => {
      const breakdown: PurchaseCategoryBreakdownRow[] = [
        { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', amount: '90.0000' },
        { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '10.0000' },
      ];
      const w = rulePurchaseCategoryConcentration(breakdown, '100.0000');
      expect(w).toBeNull();
    });

    it('returns null when purchaseCategoryTotal is near zero', () => {
      const breakdown: PurchaseCategoryBreakdownRow[] = [
        { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '1' },
      ];
      expect(rulePurchaseCategoryConcentration(breakdown, '0')).toBeNull();
      expect(rulePurchaseCategoryConcentration(breakdown, '1e-12')).toBeNull();
    });
  });

  describe('rulePurchaseUncategorizedShare', () => {
    it('emits when uncategorized share crosses warning', () => {
      const breakdown: PurchaseCategoryBreakdownRow[] = [
        { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', amount: '20.0000' },
        { categoryId: 'a', nameAr: 'A', nameEn: 'A', amount: '80.0000' },
      ];
      const w = rulePurchaseUncategorizedShare(breakdown, '100.0000');
      expect(w).not.toBeNull();
      expect(w!.id).toBe('purchase_uncategorized_share_warning');
      expect(w!.severity).toBe('warning');
      expect(w!.values).toMatchObject({ uncategorizedShare: 0.2, thresholdWarning: 0.15 });
    });
  });

  describe('ruleMissingSupplierBreakdown', () => {
    it('fires when suppliers >= 3 and uncategorized share >= 0.25', () => {
      const rows: SupplierCategoryBreakdownRow[] = [
        { categoryId: 'c1', nameAr: 'C', nameEn: 'C', count: 2 },
        { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', count: 1 },
      ];
      const w = ruleMissingSupplierBreakdown(rows, 3);
      expect(w).not.toBeNull();
      expect(w!.id).toBe('missing_supplier_breakdown_warning');
    });

    it('does not fire when suppliersInPeriodCount < 3', () => {
      const rows: SupplierCategoryBreakdownRow[] = [
        { categoryId: null, nameAr: 'غير مصنّف', nameEn: 'Uncategorized', count: 2 },
      ];
      expect(ruleMissingSupplierBreakdown(rows, 2)).toBeNull();
    });
  });

  describe('rulePurchaseCategorySpike', () => {
    it('fires with at least two valid prior months and strong increase', () => {
      const m = monthsTemplate('10');
      m[2] = '10';
      m[1] = '10';
      m[3] = '100';
      const pl = plPurchasesCategory({ spike: m });
      const w = rulePurchaseCategorySpike(pl, 4);
      expect(w).not.toBeNull();
      expect(w!.id).toBe('purchase_category_spike_warning');
      expect(Number(w?.values?.monthsUsed)).toBeGreaterThanOrEqual(2);
      expect(Number(w?.values?.increaseRatio)).toBeGreaterThanOrEqual(0.4);
    });

    it('does not fire with fewer than 2 valid prior months', () => {
      const m = monthsTemplate('');
      m[0] = '10';
      m[3] = '500';
      const pl = plPurchasesCategory({ only: m });
      expect(rulePurchaseCategorySpike(pl, 4)).toBeNull();
    });

    it('returns null when selectedMonth is null', () => {
      const pl = plPurchasesCategory({ x: monthsTemplate('10') });
      expect(rulePurchaseCategorySpike(pl, null)).toBeNull();
    });
  });
});
