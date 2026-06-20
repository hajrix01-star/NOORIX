import { describe, expect, it } from '@jest/globals';
import { computeOutflowNetTaxFromTotal } from './invoice-outflow-tax.util';

describe('computeOutflowNetTaxFromTotal', () => {
  it('returns zero tax when not taxable', () => {
    expect(computeOutflowNetTaxFromTotal(500, false)).toEqual({
      net: '500.0000',
      tax: '0.0000',
    });
  });

  it('balances net + tax = gross at 15%', () => {
    const { net, tax } = computeOutflowNetTaxFromTotal(1000, true, 15);
    expect(Number(net) + Number(tax)).toBeCloseTo(1000, 4);
    expect(Number(net)).toBeCloseTo(869.57, 2);
    expect(Number(tax)).toBeCloseTo(130.43, 2);
  });

  it('uses custom company rate 10%', () => {
    const at10 = computeOutflowNetTaxFromTotal(1100, true, 10);
    const at15 = computeOutflowNetTaxFromTotal(1100, true, 15);
    expect(Number(at10.net) + Number(at10.tax)).toBeCloseTo(1100, 4);
    expect(Number(at10.tax)).toBeLessThan(Number(at15.tax));
  });
});
