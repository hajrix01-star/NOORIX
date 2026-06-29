import { describe, expect, it } from 'vitest';
import {
  expenseRatio,
  grossMargin,
  profitMargin,
  purchaseRatio,
} from './plDisplaySelectors';

describe('plDisplaySelectors', () => {
  it('preserves negative net profit margin', () => {
    expect(profitMargin(-10000, 100000)).toBe(-10);
  });

  it('calculates positive net profit margin', () => {
    expect(profitMargin(15000, 100000)).toBe(15);
  });

  it('does not return NaN or Infinity when sales are zero', () => {
    expect(profitMargin(1000, 0)).toBeNull();
  });

  it('calculates purchase ratio as a positive sales ratio', () => {
    expect(purchaseRatio(30000, 100000)).toBe(30);
  });

  it('calculates expense ratio as a positive sales ratio', () => {
    expect(expenseRatio(12000, 100000)).toBe(12);
  });

  it('preserves negative gross margin', () => {
    expect(grossMargin(-5000, 100000)).toBe(-5);
  });
});
