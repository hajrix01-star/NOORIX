import { describe, expect, it } from 'vitest';
import {
  normalizeInvoiceListResponse,
  zeroInvoiceListOutflowSummary,
  zeroInvoiceListSums,
} from './invoice-list-response';

describe('invoice-list-response', () => {
  it('normalizes wrapped invoice list payloads', () => {
    const response = normalizeInvoiceListResponse(
      {
        data: {
          items: [{ id: 'invoice-1' }],
          total: '2',
          page: '3',
          pageSize: '25',
          sums: {
            all: { net: '100', tax: '15', total: '115', count: '2' },
          },
          sumsByKind: [{ kind: 'sale', net: 100, tax: 15, total: 115, count: 2 }],
          inflowByVault: [{ vaultId: 7, total: 80, outflow: 10, remainder: 70, nameAr: 'خزنة' }],
          outflowSummary: { purchasesTotal: 50, expensesTotal: 20, taxTotal: 5 },
        },
      },
      { page: 1, pageSize: 50 },
    );

    expect(response.items).toEqual([{ id: 'invoice-1' }]);
    expect(response.total).toBe(2);
    expect(response.page).toBe(3);
    expect(response.pageSize).toBe(25);
    expect(response.sums.all).toEqual({ net: '100', tax: '15', total: '115', count: 2 });
    expect(response.sums.inflow).toEqual({ net: '0', tax: '0', total: '0', count: 0 });
    expect(response.sumsByKind[0]).toEqual({ kind: 'sale', net: '100', tax: '15', total: '115', count: 2 });
    expect(response.inflowByVault[0]).toMatchObject({ vaultId: '7', total: '80', outflow: '10', remainder: '70' });
    expect(response.outflowSummary).toEqual({ purchasesTotal: '50', expensesTotal: '20', taxTotal: '5' });
  });

  it('normalizes direct array payloads as invoice items', () => {
    const response = normalizeInvoiceListResponse([{ id: 'invoice-1' }], { page: 4, pageSize: 20 });
    expect(response.items).toEqual([{ id: 'invoice-1' }]);
    expect(response.page).toBe(4);
    expect(response.pageSize).toBe(20);
    expect(response.sums).toEqual(zeroInvoiceListSums());
    expect(response.outflowSummary).toEqual(zeroInvoiceListOutflowSummary());
  });
});
