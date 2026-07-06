import Decimal from 'decimal.js';
import { loadPlDetailInvoices, sumInvoiceTotalAmountByMonth } from './reports-pl-invoice-detail.util';

describe('reports P&L invoice detail helpers', () => {
  it('sums sales-channel monthly amounts from channel rows, not invoice totals', async () => {
    const prisma = {
      ledgerEntry: { findMany: jest.fn() },
      invoice: { findMany: jest.fn() },
      dailySalesChannel: {
        findMany: jest.fn().mockResolvedValue([
          { amount: new Decimal(250), summary: { transactionDate: new Date(Date.UTC(2026, 0, 5)) } },
          { amount: new Decimal(100), summary: { transactionDate: new Date(Date.UTC(2026, 1, 8)) } },
        ]),
      },
    };

    const months = await sumInvoiceTotalAmountByMonth(
      prisma,
      'company-1',
      2026,
      'sales',
      'sales-channel:vault-bank',
      new Map(),
    );

    expect(months[0].toNumber()).toBe(250);
    expect(months[1].toNumber()).toBe(100);
    expect(prisma.dailySalesChannel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vaultId: 'vault-bank',
        }),
      }),
    );
  });

  it('shows only the selected sales-channel amount in detail rows', async () => {
    const prisma = {
      ledgerEntry: { findMany: jest.fn() },
      dailySalesChannel: { findMany: jest.fn() },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'invoice-1',
            invoiceNumber: 'DS-20260105-001',
            supplierInvoiceNumber: null,
            kind: 'sale',
            totalAmount: new Decimal(1000),
            netAmount: new Decimal(869.57),
            taxAmount: new Decimal(130.43),
            transactionDate: new Date(Date.UTC(2026, 0, 5)),
            notes: null,
            categoryId: null,
            supplier: null,
            expenseLine: null,
            dailySalesSummary: {
              summaryNumber: 'DS-20260105-001',
              channels: [
                { amount: new Decimal(700), vault: { id: 'vault-cash', nameAr: 'Cash', nameEn: 'Cash' } },
                { amount: new Decimal(300), vault: { id: 'vault-bank', nameAr: 'Bank', nameEn: 'Bank' } },
              ],
            },
          },
        ]),
      },
    };

    const rows = await loadPlDetailInvoices(
      prisma,
      'company-1',
      2026,
      undefined,
      'sales',
      'sales-channel:vault-bank',
      new Map(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].totalAmount).toBe('300');
    expect(rows[0].channelNames).toEqual([{ nameAr: 'Bank', nameEn: 'Bank', amount: '300' }]);
  });
});
