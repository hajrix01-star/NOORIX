import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { splitGrossByAppShare } from './costAccountingAppsScreenUtils';

describe('costAccountingAppsScreenUtils', () => {
  it('splits gross total by app share while preserving current cash/bank ratio', () => {
    const result = splitGrossByAppShare({
      grossTotal: new Decimal(1000),
      appShare: new Decimal(0.3),
      currentCash: new Decimal(200),
      currentBank: new Decimal(800),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grossApp.toNumber()).toBe(300);
    expect(result.grossCash.toNumber()).toBe(140);
    expect(result.grossBank.toNumber()).toBe(560);
  });

  it('uses an even cash/bank split when the current local total is zero', () => {
    const result = splitGrossByAppShare({
      grossTotal: new Decimal(1000),
      appShare: new Decimal(0.4),
      currentCash: new Decimal(0),
      currentBank: new Decimal(0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grossApp.toNumber()).toBe(400);
    expect(result.grossCash.toNumber()).toBe(300);
    expect(result.grossBank.toNumber()).toBe(300);
  });

  it('rejects invalid gross total or app share values', () => {
    expect(
      splitGrossByAppShare({
        grossTotal: new Decimal(0),
        appShare: new Decimal(0.3),
        currentCash: new Decimal(1),
        currentBank: new Decimal(1),
      }).ok,
    ).toBe(false);
    expect(
      splitGrossByAppShare({
        grossTotal: new Decimal(1000),
        appShare: new Decimal(1.2),
        currentCash: new Decimal(1),
        currentBank: new Decimal(1),
      }).ok,
    ).toBe(false);
  });
});
