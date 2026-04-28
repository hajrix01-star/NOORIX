import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_GENERIC_INSIGHT_THRESHOLDS,
  DEFAULT_RESTAURANT_INSIGHT_THRESHOLDS,
  mergeInsightThresholds,
  validateInsightThresholds,
  type CompanyInsightThresholdsPayload,
} from './company-insight-thresholds';

describe('company-insight-thresholds', () => {
  describe('defaults', () => {
    it('generic defaults match specification', () => {
      expect(DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales).toEqual({
        warning: 0.65,
        critical: 0.8,
      });
      expect(DEFAULT_GENERIC_INSIGHT_THRESHOLDS.expenseToSales).toEqual({
        warning: 0.35,
        critical: 0.5,
      });
      expect(DEFAULT_GENERIC_INSIGHT_THRESHOLDS.netProfitMargin).toEqual({
        warningBelow: 0.05,
        criticalBelow: 0,
      });
    });

    it('restaurant defaults match specification', () => {
      expect(DEFAULT_RESTAURANT_INSIGHT_THRESHOLDS.purchaseToSales).toEqual({
        warning: 0.35,
        critical: 0.45,
      });
      expect(DEFAULT_RESTAURANT_INSIGHT_THRESHOLDS.expenseToSales).toEqual({
        warning: 0.4,
        critical: 0.55,
      });
      expect(DEFAULT_RESTAURANT_INSIGHT_THRESHOLDS.netProfitMargin).toEqual({
        warningBelow: 0.1,
        criticalBelow: 0,
      });
    });
  });

  describe('mergeInsightThresholds', () => {
    it('merges partial overrides with generic defaults', () => {
      const merged = mergeInsightThresholds({
        purchaseToSales: { warning: 0.4 },
        netProfitMargin: { warningBelow: 0.12 },
      });
      expect(merged.purchaseToSales).toEqual({ warning: 0.4, critical: 0.8 });
      expect(merged.expenseToSales).toEqual({
        warning: 0.35,
        critical: 0.5,
      });
      expect(merged.netProfitMargin).toEqual({
        warningBelow: 0.12,
        criticalBelow: 0,
      });
    });

    it('does not mutate DEFAULT_GENERIC_INSIGHT_THRESHOLDS', () => {
      const beforePs = DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales.warning;
      mergeInsightThresholds({
        purchaseToSales: { warning: 0.11, critical: 0.22 },
        expenseToSales: { warning: 0.33 },
      });
      expect(DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales.warning).toBe(beforePs);
      expect(DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales).toEqual({
        warning: 0.65,
        critical: 0.8,
      });
    });

    it('returns full clone for empty overrides', () => {
      const a = mergeInsightThresholds(undefined);
      const b = mergeInsightThresholds(undefined);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      a.purchaseToSales.warning = 0.01;
      expect(b.purchaseToSales.warning).toBe(0.65);
    });
  });

  describe('validateInsightThresholds', () => {
    const valid: CompanyInsightThresholdsPayload = {
      purchaseToSales: { warning: 0.2, critical: 0.9 },
      expenseToSales: { warning: 0.1, critical: 0.2 },
      netProfitMargin: { warningBelow: 0.08, criticalBelow: 0 },
    };

    it('passes for valid thresholds', () => {
      expect(() => validateInsightThresholds(valid)).not.toThrow();
    });

    it('fails when warning >= critical on purchaseToSales', () => {
      expect(() =>
        validateInsightThresholds({
          ...valid,
          purchaseToSales: { warning: 0.8, critical: 0.8 },
        }),
      ).toThrow(BadRequestException);
    });

    it('fails when values are outside 0..1 (purchaseToSales)', () => {
      expect(() =>
        validateInsightThresholds({
          ...valid,
          purchaseToSales: { warning: 0.2, critical: 1.01 },
        }),
      ).toThrow(BadRequestException);
    });

    it('fails for non-finite numbers', () => {
      expect(() =>
        validateInsightThresholds({
          ...valid,
          expenseToSales: { warning: NaN, critical: 0.5 },
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        validateInsightThresholds({
          ...valid,
          expenseToSales: { warning: 0.1, critical: Number.POSITIVE_INFINITY },
        }),
      ).toThrow(BadRequestException);
    });

    it('fails when netProfitMargin criticalBelow > warningBelow', () => {
      expect(() =>
        validateInsightThresholds({
          ...valid,
          netProfitMargin: { warningBelow: 0.05, criticalBelow: 0.06 },
        }),
      ).toThrow(BadRequestException);
    });
  });
});
