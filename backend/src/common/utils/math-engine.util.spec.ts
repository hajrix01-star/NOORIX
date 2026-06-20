import { describe, expect, it } from '@jest/globals';
import {
  resolveVatRateDecimal,
  splitTaxBalancedHalalas,
  TAX_RATE,
} from './math-engine';
import { computeOutflowNetTaxFromTotal } from '../invoice/invoice-outflow-tax.util';

describe('resolveVatRateDecimal', () => {
  it('defaults to 15% when missing', () => {
    expect(resolveVatRateDecimal(null).toString()).toBe(TAX_RATE.toString());
  });

  it('converts percent to decimal', () => {
    expect(resolveVatRateDecimal(10).toString()).toBe('0.1');
  });
});

describe('splitTaxBalancedHalalas', () => {
  it('balances net + tax = gross at 15%', () => {
    const { net, tax } = splitTaxBalancedHalalas(1000, TAX_RATE);
    expect(net.toNumber()).toBeCloseTo(869.57, 2);
    expect(tax.toNumber()).toBeCloseTo(130.43, 2);
    expect(net.plus(tax).toNumber()).toBe(1000);
  });

  it('balances at custom 10% rate', () => {
    const { net, tax } = splitTaxBalancedHalalas(1100, '0.1');
    expect(net.plus(tax).toNumber()).toBe(1100);
  });
});

describe('computeOutflowNetTaxFromTotal', () => {
  it('returns zero tax when not taxable', () => {
    expect(computeOutflowNetTaxFromTotal(500, false)).toEqual({
      net: '500.0000',
      tax: '0.0000',
    });
  });

  it('uses company rate for taxable invoices', () => {
    const at15 = computeOutflowNetTaxFromTotal(1000, true, 15);
    const at10 = computeOutflowNetTaxFromTotal(1000, true, 10);
    expect(Number(at15.net) + Number(at15.tax)).toBeCloseTo(1000, 4);
    expect(Number(at10.net) + Number(at10.tax)).toBeCloseTo(1000, 4);
    expect(Number(at10.tax)).toBeLessThan(Number(at15.tax));
  });
});
