import { describe, expect, it } from 'vitest';
import { buildPrintableGeneralReportV2Html, buildStatementRowsForV2, buildV2ExportRows } from './generalReportV2Model';
import type { GeneralProfitLossReport } from './reportTypes';
import { buildFlatRows, buildVisibleRows } from './reportHelpers';

const t = (key: string) =>
  ({
    reportItem: 'Item',
    reportAnnualTotal: 'Annual total',
    reportGeneralV2: 'Income statement',
    reportAmountBasisGrossShort: 'VAT inclusive',
    reports: 'Reports',
    print: 'Print',
  })[key] ?? key;

const report: GeneralProfitLossReport = {
  amountBasis: 'gross_including_vat',
  months: [{ index: 1, label: 'Jan' }],
  groups: [
    {
      key: 'sales',
      labelAr: 'Sales',
      labelEn: 'Sales',
      months: ['100'],
      total: '100',
      percentOfSalesMonths: ['100'],
      percentOfSalesYear: '100',
      items: [
        {
          key: 'kind:sale',
          labelAr: 'Sales invoices',
          labelEn: 'Sales invoices',
          months: ['100'],
          total: '100',
          percentOfSalesMonths: ['100'],
          percentOfSalesYear: '100',
        },
      ],
    },
  ],
  summaryRows: [],
  cards: { sales: '100', purchases: '0', expenses: '0', grossProfit: '100', netProfit: '100' },
};

describe('generalReportV2Model', () => {
  it('builds statement rows with a protected group total row', () => {
    const visible = buildVisibleRows(buildFlatRows(report), {});
    const rows = buildStatementRowsForV2(visible);

    expect(rows.map((row) => row.rowType)).toEqual(['item', 'groupTotal']);
  });

  it('builds export rows without needing screen state', () => {
    const rows = buildStatementRowsForV2(buildVisibleRows(buildFlatRows(report), {}));
    const exported = buildV2ExportRows(rows, {
      lang: 'en',
      t,
      selectedMonthNumber: null,
      monthLabel: '',
      year: 2026,
      monthLabels: ['Jan'],
    });

    expect(exported[0]).toMatchObject({ Item: '  Sales invoices', Jan: '100' });
  });

  it('builds printable HTML outside the React screen', () => {
    const rows = buildStatementRowsForV2(buildVisibleRows(buildFlatRows(report), {}));
    const html = buildPrintableGeneralReportV2Html({
      report,
      visibleRows: rows,
      selectedMonthNumber: 1,
      monthLabel: 'Jan',
      year: 2026,
      lang: 'en',
      t,
      companyName: 'Noorix',
    });

    expect(html).toContain('<' + 'table class="print-table">');
    expect(html).toContain('Noorix');
    expect(html).toContain('Jan 2026');
  });
});
