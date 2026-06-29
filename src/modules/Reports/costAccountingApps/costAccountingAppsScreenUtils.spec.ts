import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { defaultCostAppsDraftValues, parseCostAppsDraft, splitGrossByAppShare } from './costAccountingAppsScreenUtils';

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

describe('cost accounting apps draft values', () => {
  it('returns safe defaults for empty or corrupted draft JSON', () => {
    const defaults = defaultCostAppsDraftValues();
    expect(parseCostAppsDraft(null)).toMatchObject({
      grossAppStr: '',
      vatInclusive: true,
      commissionPctStr: '25',
      commissionBase: 'gross',
      cogsLocalPctStr: '0',
      appPriceMarkupPctStr: '0',
      reverseAppSharePctStr: '30',
      targetProfitStr: '20000',
    });
    expect(parseCostAppsDraft('{bad json')).toMatchObject({
      vatRatePctStr: defaults.vatRatePctStr,
      importFrom: defaults.importFrom,
      importTo: defaults.importTo,
    });
  });

  it('normalizes persisted draft fields', () => {
    const draft = parseCostAppsDraft(JSON.stringify({
      grossAppStr: 123,
      vatInclusive: false,
      commissionBase: 'net',
      fixedLines: [
        { id: 'l1', label: 'Rent', amount: 500 },
        { id: '', label: null, amount: null },
      ],
      importFrom: '2026-01-01',
      importTo: '2026-01-31',
    }));

    expect(draft.grossAppStr).toBe('123');
    expect(draft.vatInclusive).toBe(false);
    expect(draft.commissionBase).toBe('net');
    expect(draft.importFrom).toBe('2026-01-01');
    expect(draft.importTo).toBe('2026-01-31');
    expect(draft.fixedLines[0]).toEqual({ id: 'l1', label: 'Rent', amount: '500' });
    expect(draft.fixedLines).toHaveLength(2);
    expect(draft.fixedLines[1].id).toBeTruthy();
  });
});
