import { buildSalesSummaryListModel } from './sales-summary-list-model.util';

describe('buildSalesSummaryListModel', () => {
  it('builds official day rows and page summary from backend summaries', () => {
    const model = buildSalesSummaryListModel([
      {
        id: 'morning',
        summaryNumber: 'S-1',
        transactionDate: '2026-07-06',
        shift: 'morning',
        customerCount: 10,
        totalAmount: '100.50',
        cashOnHand: '20',
        status: 'active',
        channels: [{ vaultId: 'cash', amount: '100.50', vault: { id: 'cash', nameAr: 'Cash', sortOrder: 1 } }],
      },
      {
        id: 'evening',
        summaryNumber: 'S-2',
        transactionDate: '2026-07-06',
        shift: 'evening',
        customerCount: 5,
        totalAmount: '50',
        cashOnHand: '10',
        status: 'active',
        channels: [{ vaultId: 'cash', amount: '50', vault: { id: 'cash', nameAr: 'Cash', sortOrder: 1 } }],
      },
    ]);

    expect(model.items).toHaveLength(2);
    expect(model.dayRows).toHaveLength(1);
    expect(model.dayRows[0]).toMatchObject({
      id: 'day-2026-07-06',
      customerCount: 15,
      totalAmount: 150.5,
      cashOnHand: 30,
      avgPerCustomer: 150.5 / 15,
      summaryNumbersText: 'S-1 / S-2',
    });
    expect(model.dayRows[0].channels[0].amount).toBe(150.5);
    expect(model.pageSummary).toMatchObject({
      rowCount: 1,
      customerCount: 15,
      totalAmount: 150.5,
      avgPerCustomer: 150.5 / 15,
    });
  });

  it('excludes cancelled day rows from page totals', () => {
    const model = buildSalesSummaryListModel([
      {
        id: 'cancelled',
        summaryNumber: 'S-3',
        transactionDate: '2026-07-07',
        shift: 'all',
        customerCount: 100,
        totalAmount: '999',
        status: 'cancelled',
      },
    ]);

    expect(model.dayRows[0].status).toBe('cancelled');
    expect(model.pageSummary).toEqual({
      rowCount: 0,
      customerCount: 0,
      totalAmount: 0,
      avgPerCustomer: 0,
    });
  });
});
