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
      transferVolume: '0',
      rows: [
        expect.objectContaining({ vaultId: 'cash', periodResult: '35', inflowSharePct: 75 }),
        expect.objectContaining({ vaultId: 'bank', periodResult: '15', inflowSharePct: 25 }),
      ],
    });
  });

  it('excludes internal transfers from company flow while preserving each vault movement', () => {
    const result = buildDashboardVaultActivity([
      {
        id: 'source', nameAr: 'Source', nameEn: null, type: 'cash', sortOrder: 1,
        isArchived: false, totalIn: 0, totalOut: 500,
        externalIn: 0, externalOut: 0, transferIn: 0, transferOut: 500,
      },
      {
        id: 'destination', nameAr: 'Destination', nameEn: null, type: 'bank', sortOrder: 2,
        isArchived: false, totalIn: 500, totalOut: 0,
        externalIn: 0, externalOut: 0, transferIn: 500, transferOut: 0,
      },
    ]);

    expect(result.totalInflow).toBe('0');
    expect(result.totalOutflow).toBe('0');
    expect(result.periodResult).toBe('0');
    expect(result.transferVolume).toBe('500');
    expect(result.rows.find((row) => row.vaultId === 'source')?.periodResult).toBe('-500');
    expect(result.rows.find((row) => row.vaultId === 'destination')?.periodResult).toBe('500');
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
