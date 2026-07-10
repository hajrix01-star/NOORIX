import { formatNumber, formatPercent } from '../../../utils/money';
import type { MoneyLang } from '../../../utils/money';
import type { OwnerOverviewExportRow } from '../../../types/api';

export function ownerExcelFilename(year: number, selectedMonthNum: number | null): string {
  return `owner-dashboard-${year}${selectedMonthNum ? `-m${selectedMonthNum}` : ''}.xlsx`;
}

export function ownerPdfFilename(year: number): string {
  return `owner-dashboard-${year}.pdf`;
}

type ExcelRow = Record<string, string | number>;

function pct(value: number | null, lang: MoneyLang) {
  return value == null ? '-' : formatPercent(value, lang);
}

function rowName(row: OwnerOverviewExportRow, lang: string) {
  return lang === 'ar' ? row.companyNameAr : row.companyNameEn;
}

export function buildOwnerExcelRows(rows: OwnerOverviewExportRow[], lang: string): ExcelRow[] {
  const l = lang as MoneyLang;
  return rows.map((row) => ({
    [lang === 'ar' ? 'الشركة' : 'Company']: rowName(row, lang),
    [lang === 'ar' ? 'المبيعات' : 'Sales']: formatNumber(row.sales, l),
    [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']: pct(row.purchasesToSalesPct, l),
    [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']: pct(row.expensesToSalesPct, l),
    [lang === 'ar' ? 'صافي الربح' : 'Net profit']: formatNumber(row.netProfit, l),
  }));
}

export function buildOwnerPdfColumns(lang: string): string[] {
  return [
    lang === 'ar' ? 'الشركة' : 'Company',
    lang === 'ar' ? 'المبيعات' : 'Sales',
    lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %',
    lang === 'ar' ? 'صافي الربح' : 'Net profit',
  ];
}

export function buildOwnerPdfData(rows: OwnerOverviewExportRow[], lang: string): string[][] {
  const l = lang as MoneyLang;
  return rows.map((row) => [
    rowName(row, lang),
    formatNumber(row.sales, l),
    pct(row.purchasesToSalesPct, l),
    formatNumber(row.netProfit, l),
  ]);
}
