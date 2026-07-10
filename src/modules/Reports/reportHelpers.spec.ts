import { describe, expect, it } from 'vitest';
import {
  buildCollapsedGroupsForLevel,
  buildExportRowsFromVisibleRows,
  buildFlatRows,
  buildVisibleRows,
} from './reportHelpers';
import type { GeneralProfitLossReport, PlDisplayRow } from './reportTypes';

const t = (key: string) =>
  ({
    reportItem: 'Item',
    revenueGroup: 'Revenue',
    purchasesGroup: 'Purchases',
    expensesGroup: 'Expenses',
    reportAnnualTotal: 'Annual total',
    reportSalesShareYear: 'Annual share',
    selectedMonth: 'Selected month',
    reportSalesShareMonth: 'Month share',
  })[key] ?? key;

const report: GeneralProfitLossReport = {
  amountBasis: 'gross_including_vat',
  months: [{ index: 1, label: 'Jan' }],
  groups: [
    {
      key: 'sales',
      labelAr: 'المبيعات',
      labelEn: 'Sales',
      months: ['115'],
      total: '115',
      percentOfSalesMonths: ['100'],
      percentOfSalesYear: '100',
      items: [
        {
          key: 'kind:sale',
          labelAr: 'مبيعات',
          labelEn: 'Sales invoices',
          months: ['115'],
          total: '115',
          percentOfSalesMonths: ['100'],
          percentOfSalesYear: '100',
        },
      ],
    },
    {
      key: 'expenses',
      labelAr: 'المصاريف',
      labelEn: 'Expenses',
      months: ['23'],
      total: '23',
      percentOfSalesMonths: ['20'],
      percentOfSalesYear: '20',
      items: [],
    },
  ],
  summaryRows: [],
  cards: { sales: '115', purchases: '0', expenses: '23', grossProfit: '115', netProfit: '92' },
};

describe('reportHelpers P&L presentation contract', () => {
  it('keeps level 1 exports aligned with visible summary rows', () => {
    const collapsed = buildCollapsedGroupsForLevel(report, 1);
    const visible = buildVisibleRows(buildFlatRows(report, collapsed), collapsed);
    const exported = buildExportRowsFromVisibleRows(visible, 'en', t, null);

    expect(visible.map((row: PlDisplayRow) => row.rowType)).toEqual(['group', 'group']);
    expect(exported).toHaveLength(visible.length);
    expect(exported[0]).toMatchObject({ Item: 'Sales', 'Annual total': '115' });
  });

  it('uses the selected month column for monthly mode without annual columns', () => {
    const visible = buildVisibleRows(buildFlatRows(report, {}), {});
    const exported = buildExportRowsFromVisibleRows(visible, 'en', t, 1, { amountColumnTitle: 'January 2026' });

    expect(exported[0]).toHaveProperty('January 2026', '115');
    expect(exported[0]).not.toHaveProperty('Annual total');
  });
});
