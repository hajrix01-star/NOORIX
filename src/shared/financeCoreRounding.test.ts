import { describe, expect, it } from 'vitest';
import { roundMoney, roundMoney2 } from '@noorix/finance-core';

describe('finance-core money rounding', () => {
  it('rounds official money amounts through one shared helper', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney('99.994')).toBe(99.99);
    expect(roundMoney2(12.345)).toBe(12.35);
  });

  it('normalizes empty money inputs to zero', () => {
    expect(roundMoney(undefined)).toBe(0);
    expect(roundMoney(null)).toBe(0);
  });
});
