import { describe, expect, it } from 'vitest';
import {
  calculateCashReportTotals,
  filterCashVaultRows,
  mapCashReportVaultRows,
  resolveInvoicesCashReportPeriodLine,
  sumSalesCashOnHand,
} from './invoicesCashReportModel';

const fmt = (value: number) => value.toFixed(2);

describe('invoicesCashReportModel', () => {
  it('resolves report period from URL range when present', () => {
    expect(
      resolveInvoicesCashReportPeriodLine({
        fromUrl: '2026-01-01',
        toUrl: '2026-01-31',
        invoiceQueryStartDate: '2026-02-01',
        invoiceQueryEndDate: '2026-02-28',
      }),
    ).toBe('2026-01-01 \u2014 2026-01-31');
  });

  it('filters and maps cash vault rows only', () => {
    const rows = filterCashVaultRows(
      [
        { vaultId: 'cash-1', nameEn: 'Cash', total: '100', outflow: '30', remainder: '70' },
        { vaultId: 'cash-2', nameAr: '', nameEn: ' ', total: '50', outflow: '10', remainder: '40' },
        { vaultId: 'bank-1', nameEn: 'Bank', total: '200', outflow: '20', remainder: '180' },
      ],
      [
        { id: 'cash-1', type: 'cash' },
        { id: 'cash-2', type: 'cash' },
        { id: 'bank-1', type: 'bank' },
      ],
    );

    expect(rows).toHaveLength(2);
    expect(mapCashReportVaultRows({ rows, lang: 'en', fmt })[0]).toEqual({
      vaultName: 'Cash',
      inflow: '100.00',
      outflow: '30.00',
      remainder: '70.00',
    });
    expect(mapCashReportVaultRows({ rows, lang: 'en', fmt })[1]?.vaultName).toBe('\u2014');
  });

  it('calculates totals and sales cash on hand', () => {
    expect(
      calculateCashReportTotals([
        { total: '100', outflow: '25', remainder: '75' },
        { total: 40, outflow: 10, remainder: 30 },
      ]),
    ).toEqual({ inflow: 140, outflow: 35, remainder: 105 });
    expect(sumSalesCashOnHand([{ cashOnHand: '10' }, { cashOnHand: 15 }, {}])).toBe(25);
  });
});
