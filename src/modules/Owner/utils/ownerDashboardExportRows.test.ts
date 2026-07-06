import { describe, expect, it } from 'vitest';
import { buildOwnerExcelRows, buildOwnerPdfData } from './ownerDashboardExportRows';
import type { OwnerOverviewExportRow } from '../../../types/api';

const rows: OwnerOverviewExportRow[] = [
  {
    companyId: 'total',
    companyNameAr: 'كل الشركات',
    companyNameEn: 'All companies',
    sales: 1000,
    purchasesToSalesPct: 25,
    expensesToSalesPct: null,
    netProfit: 500,
  },
];

describe('ownerDashboardExportRows', () => {
  it('formats backend-provided export rows without recalculating ratios', () => {
    const excelRows = buildOwnerExcelRows(rows, 'en');
    expect(excelRows[0]).toMatchObject({
      Company: 'All companies',
      Sales: '1,000',
      'Purchases %': '25.0%',
      'Expenses %': '-',
      'Net profit': '500',
    });
  });

  it('builds pdf rows from official backend values', () => {
    expect(buildOwnerPdfData(rows, 'en')).toEqual([
      ['All companies', '1,000', '25.0%', '500'],
    ]);
  });
});
