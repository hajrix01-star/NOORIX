import { buildDashboardVaultActivity } from './dashboard-vault-activity.util';

describe('buildDashboardVaultActivity', () => {
  it('calculates the period result and each vault share from one total', () => {
    const result = buildDashboardVaultActivity([
      {
        id: 'bank', nameAr: 'البنك', nameEn: 'Bank', type: 'bank', sortOrder: 2,
        isArchived: false, totalIn: '25', totalOut: '10',
      },
      {
        id: 'cash', nameAr: 'النقد', nameEn: 'Cash', type: 'cash', sortOrder: 1,
        isArchived: false, totalIn: '75', totalOut: '40',
      },
    ]);

    expect(result).toEqual({
      totalInflow: '100',
      totalOutflow: '50',
      periodResult: '50',
      rows: [
        expect.objectContaining({ vaultId: 'cash', periodResult: '35', inflowSharePct: 75 }),
        expect.objectContaining({ vaultId: 'bank', periodResult: '15', inflowSharePct: 25 }),
      ],
    });
  });

  it('returns a null share instead of an invalid percentage when there is no inflow', () => {
    const result = buildDashboardVaultActivity([
      {
        id: 'cash', nameAr: 'النقد', nameEn: null, type: 'cash', sortOrder: 1,
        isArchived: false, totalIn: 0, totalOut: 15,
      },
    ]);

    expect(result.totalInflow).toBe('0');
    expect(result.periodResult).toBe('-15');
    expect(result.rows[0]?.inflowSharePct).toBeNull();
  });
});
