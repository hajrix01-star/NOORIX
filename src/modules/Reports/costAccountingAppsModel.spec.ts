import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  computeCostAppsPl,
  reverseGrossTotalForTargetProfit,
  cogsCoefficientPerGrossTotal,
} from './costAccountingAppsModel';

const zeroCogs = { cogsLocalPct: new Decimal(0), appPriceMarkupPct: new Decimal(0) };

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
      ...zeroCogs,
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
      ...zeroCogs,
    });
    expect(r.grossApp.toNumber()).toBe(0);
    expect(r.commission.toNumber()).toBe(0);
    expect(r.netProfit.toNumber()).toBe(19000);
  });

  it('COGS: local pct on gross local; app uses local-equivalent base via markup', () => {
    const r = computeCostAppsPl({
      grossApp: new Decimal(26),
      grossLocalCash: new Decimal(20),
      grossLocalBank: new Decimal(0),
      vatInclusive: false,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(38),
      commissionBase: 'gross',
      fixedTotal: new Decimal(0),
      includeAppChannel: true,
      cogsLocalPct: new Decimal(50),
      appPriceMarkupPct: new Decimal(30),
    });
    expect(r.cogsLocal.toNumber()).toBe(10);
    expect(r.cogsApp.toNumber()).toBe(10);
    expect(r.cogsTotal.toNumber()).toBe(20);
    expect(r.commission.toNumber()).toBeCloseTo(9.88, 2);
    expect(r.netProfit.toNumber()).toBeCloseTo(16.12, 2);
  });
});

describe('cogsCoefficientPerGrossTotal', () => {
  it('matches manual 50% local + 30% app markup + 30% app share', () => {
    const k = cogsCoefficientPerGrossTotal(new Decimal(50), new Decimal(30), new Decimal(0.3));
    expect(k.toNumber()).toBeCloseTo(0.465384615, 5);
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
      cogsLocalPct: new Decimal(0),
      appPriceMarkupPct: new Decimal(0),
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
      ...zeroCogs,
    });
    expect(check.netProfit.toNumber()).toBeCloseTo(20000, 0);
  });

  it('reverse with 30% app share, 50% COGS, 30% markup, 38% commission, VAT off', () => {
    const res = reverseGrossTotalForTargetProfit({
      targetProfit: new Decimal(20000),
      fixedTotal: new Decimal(0),
      appShareDecimal: new Decimal(0.3),
      vatInclusive: false,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(38),
      commissionBase: 'gross',
      cogsLocalPct: new Decimal(50),
      appPriceMarkupPct: new Decimal(30),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const G = res.grossTotal;
    const check = computeCostAppsPl({
      grossApp: G.mul(0.3),
      grossLocalCash: G.mul(0.7),
      grossLocalBank: new Decimal(0),
      vatInclusive: false,
      vatRate: new Decimal(0.15),
      commissionPct: new Decimal(38),
      commissionBase: 'gross',
      fixedTotal: new Decimal(0),
      includeAppChannel: true,
      cogsLocalPct: new Decimal(50),
      appPriceMarkupPct: new Decimal(30),
    });
    expect(check.netProfit.toNumber()).toBeCloseTo(20000, 0);
  });
});
