import { describe, expect, it } from 'vitest';
import { toPurchaseBatchFiniteNumber, toPurchaseBatchPositiveNumber } from './purchaseBatchNumberModel';

describe('purchaseBatchNumberModel', () => {
  it('normalizes formatted numeric values', () => {
    expect(toPurchaseBatchFiniteNumber('1,250.50')).toBe(1250.5);
  });

  it('uses fallback for empty or invalid values', () => {
    expect(toPurchaseBatchFiniteNumber('', 7)).toBe(7);
    expect(toPurchaseBatchFiniteNumber('not-a-number', 9)).toBe(9);
  });

  it('returns only positive finite numbers', () => {
    expect(toPurchaseBatchPositiveNumber('15.25')).toBe(15.25);
    expect(toPurchaseBatchPositiveNumber('0')).toBeNull();
    expect(toPurchaseBatchPositiveNumber('-1')).toBeNull();
  });
});
