import { mergeInsightThresholds } from './company-insight-thresholds';
import {
  formatInsightPercentFraction,
  ruleExpenseRatioToSales,
  ruleNegativeProfit,
  ruleNetProfitMargin,
  rulePurchaseRatioToSales,
} from './insights.rules';

describe('formatInsightPercentFraction', () => {
  it('uses at most one decimal and drops trailing .0', () => {
    expect(formatInsightPercentFraction(0.355)).toBe('35.5');
    expect(formatInsightPercentFraction(0.35)).toBe('35');
    expect(formatInsightPercentFraction(0.8)).toBe('80');
  });
});

describe('insight rule copy (ratio / margin / negative profit)', () => {
  const defaults = mergeInsightThresholds(undefined);

  it('purchase_ratio_to_sales warning includes actual ratio and warning threshold', () => {
    const out = rulePurchaseRatioToSales(0.7, defaults);
    expect(out?.severity).toBe('warning');
    expect(out?.detailAr).toContain('70%');
    expect(out?.detailAr).toContain('65%');
    expect(out?.detailEn).toContain('70%');
    expect(out?.detailEn).toContain('65%');
    expect(out?.detailEn).toMatch(/warning threshold of 65%/);
  });

  it('purchase_ratio_to_sales critical includes critical threshold', () => {
    const out = rulePurchaseRatioToSales(0.85, defaults);
    expect(out?.severity).toBe('critical');
    expect(out?.detailAr).toContain('85%');
    expect(out?.detailAr).toContain('80%');
    expect(out?.detailEn).toMatch(/critical threshold of 80%/);
  });

  it('expense_ratio_to_sales warning and critical include ratio and threshold', () => {
    const warn = ruleExpenseRatioToSales(0.4, defaults);
    expect(warn?.severity).toBe('warning');
    expect(warn?.detailAr).toContain('40%');
    expect(warn?.detailAr).toContain('35%');
    expect(warn?.detailEn).toMatch(/warning threshold of 35%/);

    const crit = ruleExpenseRatioToSales(0.5, defaults);
    expect(crit?.severity).toBe('critical');
    expect(crit?.detailAr).toContain('50%');
    expect(crit?.detailEn).toMatch(/critical threshold of 50%/);
  });

  it('net_profit_margin warning includes actual margin and healthy threshold', () => {
    const out = ruleNetProfitMargin(0.042, 10_000, defaults);
    expect(out?.severity).toBe('warning');
    expect(out?.detailAr).toContain('4.2%');
    expect(out?.detailAr).toContain('5%');
    expect(out?.detailEn).toMatch(/Net profit margin is 4\.2%, below the configured healthy threshold of 5%/);
  });

  it('negative_profit_warning uses deterministic copy', () => {
    const out = ruleNegativeProfit(-100);
    expect(out?.detailAr).toBe(
      'صافي الربح للفترة المحددة سلبي. راجع المشتريات والمصاريف المؤثرة على النتيجة.',
    );
    expect(out?.detailEn).toBe(
      'Net profit is negative for the selected period. Review purchases and expenses affecting the result.',
    );
  });

  it('net_profit_margin critical (below positive criticalBelow) when configured', () => {
    const th = mergeInsightThresholds({
      netProfitMargin: { warningBelow: 0.1, criticalBelow: 0.06 },
    });
    const out = ruleNetProfitMargin(0.05, 10_000, th);
    expect(out?.severity).toBe('critical');
    expect(out?.detailEn).toContain('below the configured critical threshold');
    expect(out?.detailEn).toContain('6%');
  });
});
