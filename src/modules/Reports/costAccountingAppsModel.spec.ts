import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { computeCostAppsPl, reverseGrossTotalForTargetProfit } from './costAccountingAppsModel';

describe('computeCostAppsPl', () => {
  it('splits VAT and subtracts commission on gross app', () => {
    const r = computeCostAppsPl({
      grossApp: new Decimal(11500),
      grossLocalCash: new Decimal(23000),
      grossLocalBank: new Decimal(0),
      vatInclusive: true,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(20),
      commissionBase: 'gross',
      fixedTotal: new Decimal(5000),
      includeAppChannel: true,
    });
    expect(r.grossTotal.toNumber()).toBe(34500);
    expect(r.commission.toNumber()).toBe(2300);
    expect(r.netSales.toNumber()).toBeCloseTo(30000, 1);
    expect(r.netProfit.toNumber()).toBeCloseTo(22700, 1);
  });

  it('without app channel zeros app and commission', () => {
    const r = computeCostAppsPl({
      grossApp: new Decimal(10000),
      grossLocalCash: new Decimal(10000),
      grossLocalBank: new Decimal(10000),
      vatInclusive: false,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(30),
      commissionBase: 'gross',
      fixedTotal: new Decimal(1000),
      includeAppChannel: false,
    });
    expect(r.grossApp.toNumber()).toBe(0);
    expect(r.commission.toNumber()).toBe(0);
    expect(r.netProfit.toNumber()).toBe(19000);
  });
});

describe('reverseGrossTotalForTargetProfit', () => {
  it('solves linear case VAT inclusive gross commission', () => {
    const res = reverseGrossTotalForTargetProfit({
      targetProfit: new Decimal(20000),
      fixedTotal: new Decimal(10000),
      appShareDecimal: new Decimal(0.4),
      vatInclusive: true,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(25),
      commissionBase: 'gross',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const check = computeCostAppsPl({
      grossApp: res.grossTotal.mul(0.4),
      grossLocalCash: res.grossTotal.mul(0.6),
      grossLocalBank: new Decimal(0),
      vatInclusive: true,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(25),
      commissionBase: 'gross',
      fixedTotal: new Decimal(10000),
      includeAppChannel: true,
    });
    expect(check.netProfit.toNumber()).toBeCloseTo(20000, 0);
  });
});
