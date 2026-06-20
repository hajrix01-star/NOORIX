import { describe, expect, it } from '@jest/globals';
import {
  resolveVatRateDecimal,
  splitTaxBalancedHalalas,
  TAX_RATE,
} from './math-engine';

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
