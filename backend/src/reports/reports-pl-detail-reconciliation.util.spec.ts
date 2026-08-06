import { reconcilePlDetailItems } from './reports-pl-detail-reconciliation.util';

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
});
