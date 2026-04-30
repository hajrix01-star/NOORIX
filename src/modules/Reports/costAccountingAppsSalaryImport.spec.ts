import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  decimalFromInvoiceTotal,
  salaryInvoiceTotalFromTotalsByKind,
  unwrapTotalsByKind,
} from './costAccountingAppsSalaryImport';

describe('unwrapTotalsByKind', () => {
  it('reads totalsByKind at root', () => {
    const tbk = unwrapTotalsByKind({
      startDate: '2026-01-01',
      totalsByKind: { salary: { totalAmount: '5000', invoiceCount: 2 } },
    });
    expect(tbk?.salary?.totalAmount).toBe('5000');
  });

  it('unwraps one data level', () => {
    const tbk = unwrapTotalsByKind({
      data: {
        totalsByKind: { salary: { totalAmount: '1200.50', invoiceCount: 1 } },
      },
    });
    expect(tbk?.salary?.totalAmount).toBe('1200.50');
  });

  it('unwraps nested data.data', () => {
    const tbk = unwrapTotalsByKind({
      data: {
        data: {
          totalsByKind: { salary: { totalAmount: '99', invoiceCount: 1 } },
        },
      },
    });
    expect(tbk?.salary?.totalAmount).toBe('99');
  });
});

describe('decimalFromInvoiceTotal', () => {
  it('parses string and number', () => {
    expect(decimalFromInvoiceTotal('1,234.5')?.toNumber()).toBeCloseTo(1234.5, 5);
    expect(decimalFromInvoiceTotal(100)?.toNumber()).toBe(100);
  });
});

describe('salaryInvoiceTotalFromTotalsByKind', () => {
  it('returns null when salary row missing', () => {
    expect(salaryInvoiceTotalFromTotalsByKind({ purchase: { totalAmount: '1', invoiceCount: 1 } })).toBeNull();
  });

  it('returns total only for salary kind', () => {
    const d = salaryInvoiceTotalFromTotalsByKind({
      salary: { totalAmount: '45000', invoiceCount: 3 },
      expense: { totalAmount: '100', invoiceCount: 1 },
    });
    expect(d).toBeInstanceOf(Decimal);
    expect(d?.toNumber()).toBe(45000);
  });
});
