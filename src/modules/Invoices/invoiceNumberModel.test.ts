import { describe, expect, it } from 'vitest';
import { hasInvoiceNumericValue, toInvoiceFiniteNumber } from './invoiceNumberModel';

describe('invoiceNumberModel', () => {
  it('normalizes invoice numeric values without leaking NaN', () => {
    expect(toInvoiceFiniteNumber('1,250.50')).toBe(1250.5);
    expect(toInvoiceFiniteNumber(42)).toBe(42);
    expect(toInvoiceFiniteNumber(null)).toBe(0);
    expect(toInvoiceFiniteNumber('not-a-number')).toBe(0);
    expect(toInvoiceFiniteNumber('not-a-number', 7)).toBe(7);
  });

  it('detects meaningful numeric values', () => {
    expect(hasInvoiceNumericValue('0')).toBe(true);
    expect(hasInvoiceNumericValue('')).toBe(false);
    expect(hasInvoiceNumericValue('abc')).toBe(false);
  });
});
