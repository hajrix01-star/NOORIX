import {
  mergePlCategoryDetailItems,
  reconcilePlDetailItems,
} from './reports-pl-detail-reconciliation.util';

describe('P&L detail reconciliation', () => {
  it('reconciles the period amount and calculates each document share of sales', () => {
    const result = reconcilePlDetailItems(
      [
        { id: '1', reportAmount: '2162' },
        { id: '2', reportAmount: '300' },
        { id: '3', reportAmount: '300' },
      ],
      '10000',
      '2762',
    );

    expect(result.documentsAmount).toBe('2762');
    expect(result.documentsComplete).toBe(true);
    expect(result.documentsMatchContext).toBe(true);
    expect(result.items.map((item) => item.percentOfSales)).toEqual(['21.6', '3', '3']);
  });

  it('flags an uncapped mismatch and does not make a claim for a capped result', () => {
    expect(reconcilePlDetailItems(
      [{ reportAmount: '2762' }],
      '10000',
      '49744',
    ).documentsMatchContext).toBe(false);

    expect(reconcilePlDetailItems(
      [{ reportAmount: '100' }],
      '10000',
      '100',
      1,
    ).documentsMatchContext).toBeNull();
  });

  it('merges all category branches and excludes duplicate invoice ledger entries', () => {
    const invoiceItems = [
      { id: 'tobacco-license', reportAmount: '30020', transactionDate: '2026-07-26' },
      { id: 'tobacco-fee', reportAmount: '4320', transactionDate: '2026-07-15' },
      { id: 'hr-1', reportAmount: '2162', transactionDate: '2026-07-31' },
      { id: 'hr-2', reportAmount: '300', transactionDate: '2026-07-24' },
      { id: 'hr-3', reportAmount: '300', transactionDate: '2026-07-24' },
    ];
    const ledgerItems = [
      { id: 'ledger-duplicate', sourceReferenceId: 'tobacco-license', reportAmount: '30020', transactionDate: '2026-07-26' },
      { id: 'ledger-open-24', sourceReferenceId: 'open-24', sourceItemKey: 'category:government', reportAmount: '3044', transactionDate: '2026-07-31' },
      { id: 'ledger-vat', sourceReferenceId: 'vat-15', sourceItemKey: 'category:government', reportAmount: '6598', transactionDate: '2026-07-31' },
      { id: 'ledger-gosi', sourceReferenceId: 'gosi', sourceItemKey: 'category:government', reportAmount: '3000', transactionDate: '2026-07-07' },
      { id: 'ledger-gosi', sourceReferenceId: 'gosi', sourceItemKey: 'category:government', reportAmount: '3000', transactionDate: '2026-07-07' },
      { id: 'ledger-other', sourceReferenceId: 'other', sourceItemKey: 'category:rent', reportAmount: '1000', transactionDate: '2026-07-01' },
    ];

    const merged = mergePlCategoryDetailItems(
      invoiceItems,
      ledgerItems,
      new Set(['category:government']),
    );
    const result = reconcilePlDetailItems(merged, '158131', '49744');

    expect(merged).toHaveLength(8);
    expect(result.documentsAmount).toBe('49744');
    expect(result.documentsMatchContext).toBe(true);
  });

  it('keeps direct payroll advance settlements posted to the category account', () => {
    const invoiceItems = [
      { id: 'salary-invoice', itemKey: 'category:salaries', reportAmount: '30951' },
    ];
    const ledgerItems = [
      {
        id: 'advance-settlement',
        sourceReferenceId: 'deduction-1',
        itemKey: 'account:salary-expense',
        sourceItemKey: 'account:salary-expense',
        reportAmount: '15400',
      },
    ];

    const merged = mergePlCategoryDetailItems(
      invoiceItems,
      ledgerItems,
      new Set(['category:salaries', 'account:salary-expense']),
    );
    const result = reconcilePlDetailItems(merged, '301167', '46351');

    expect(merged).toHaveLength(2);
    expect(result.documentsAmount).toBe('46351');
    expect(result.documentsMatchContext).toBe(true);
  });
});
