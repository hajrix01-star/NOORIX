import { describe, expect, it } from 'vitest';
import { splitTaxFromTotalAsNumbers } from './math-engine';

describe('splitTaxFromTotalAsNumbers — balanced with backend', () => {
  it('net + tax equals total after rounding', () => {
    const total = 115;
    const { net, tax } = splitTaxFromTotalAsNumbers(total, true, 0.15);
    expect(net + tax).toBeCloseTo(total, 6);
  });

  it('matches inflow-style balanced split for channel gross', () => {
    const { net, tax } = splitTaxFromTotalAsNumbers(1000, true, 0.15);
    expect(net).toBeCloseTo(869.57, 2);
    expect(tax).toBeCloseTo(130.43, 2);
    expect(net + tax).toBe(1000);
  });

  it('returns net only when not taxable', () => {
    expect(splitTaxFromTotalAsNumbers(500, false)).toEqual({ net: 500, tax: 0 });
  });
});
