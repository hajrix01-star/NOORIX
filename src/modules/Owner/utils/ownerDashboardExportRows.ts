import { formatNumber, formatPercent } from '../../../utils/money';
import type { OwnerKpiTotals } from '../types';
import type { MoneyLang } from '../../../utils/money';

export function ownerExcelFilename(year: number, selectedMonthNum: number | null): string {
  return `owner-dashboard-${year}${selectedMonthNum ? `-m${selectedMonthNum}` : ''}.xlsx`;
}

export function ownerPdfFilename(year: number): string {
  return `owner-dashboard-${year}.pdf`;
}

type ExcelRow = Record<string, string | number>;

export function buildOwnerExcelRows(aggregated: OwnerKpiTotals, lang: string): ExcelRow[] {
  const l = lang as MoneyLang;
  return [
    {
      [lang === 'ar' ? 'الشركة' : 'Company']: lang === 'ar' ? 'كل الشركات' : 'All companies',
      [lang === 'ar' ? 'المبيعات' : 'Sales']: formatNumber(aggregated.totalSales, l),
      [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']:
        aggregated.totalSales > 0
          ? formatPercent((aggregated.totalPurchases / aggregated.totalSales) * 100, l)
          : '—',
      [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']:
        aggregated.totalSales > 0
          ? formatPercent((aggregated.totalExpenses / aggregated.totalSales) * 100, l)
          : '—',
      [lang === 'ar' ? 'صافي الربح' : 'Net profit']: formatNumber(aggregated.totalNetProfit, l),
    },
    ...aggregated.byCompany.map((x) => ({
      [lang === 'ar' ? 'الشركة' : 'Company']: x.name,
      [lang === 'ar' ? 'المبيعات' : 'Sales']: formatNumber(x.sales, l),
      [lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %']:
        x.sales > 0 ? formatPercent((x.purchases / x.sales) * 100, l) : '—',
      [lang === 'ar' ? 'نسبة المصروفات' : 'Expenses %']:
        x.sales > 0 ? formatPercent((x.expenses / x.sales) * 100, l) : '—',
      [lang === 'ar' ? 'صافي الربح' : 'Net profit']: formatNumber(x.netProfit, l),
    })),
  ];
}

export function buildOwnerPdfColumns(lang: string): string[] {
  return [
    lang === 'ar' ? 'الشركة' : 'Company',
    lang === 'ar' ? 'المبيعات' : 'Sales',
    lang === 'ar' ? 'نسبة المشتريات' : 'Purchases %',
    lang === 'ar' ? 'صافي الربح' : 'Net profit',
  ];
}

export function buildOwnerPdfData(aggregated: OwnerKpiTotals, lang: string): string[][] {
  const l = lang as MoneyLang;
  const data = aggregated.byCompany.map((x) => [
    x.name,
    formatNumber(x.sales, l),
    x.sales > 0 ? formatPercent((x.purchases / x.sales) * 100, l) : '—',
    formatNumber(x.netProfit, l),
  ]);
  data.unshift([
    lang === 'ar' ? 'الإجمالي' : 'Total',
    formatNumber(aggregated.totalSales, l),
    aggregated.totalSales > 0
      ? formatPercent((aggregated.totalPurchases / aggregated.totalSales) * 100, l)
      : '—',
    formatNumber(aggregated.totalNetProfit, l),
  ]);
  return data;
}
