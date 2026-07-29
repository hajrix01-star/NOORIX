import { KPI_RECHARTS_COLORS, VAULT_RECHARTS_COLORS } from '../../../../constants/kpiCardTheme';
import type {
  DashboardSalesMetricDay,
  DashboardSalesSummary,
  DashboardTimelineMetricRow,
} from '../../../../types/api/domains/dashboard';

export const DASHBOARD_MONTH_NAMES_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const DASHBOARD_MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DASHBOARD_PIE_COLORS = [
  VAULT_RECHARTS_COLORS.bank,
  VAULT_RECHARTS_COLORS.cash,
  VAULT_RECHARTS_COLORS.app,
  KPI_RECHARTS_COLORS.netProfit,
  KPI_RECHARTS_COLORS.expenses,
  KPI_RECHARTS_COLORS.purchases,
  '#0891b2',
  '#db2777',
];

export type DashboardTranslate = (key: string) => string;

export function metricDaysToSummaries(
  rows: readonly DashboardSalesMetricDay[] | null | undefined,
): DashboardSalesSummary[] {
  return (rows ?? []).map((row, index) => ({
    id: `metric-day-${row.transactionDate}-${row.shift ?? 'all'}-${index}`,
    transactionDate: row.transactionDate,
    totalAmount: row.totalAmount,
    customerCount: row.customerCount,
    channels: [],
  }));
}

export function pickMetricSummaries(
  metricRows: readonly DashboardSalesMetricDay[] | null | undefined,
  fallbackRows: DashboardSalesSummary[],
): DashboardSalesSummary[] {
  return metricRows && metricRows.length > 0 ? metricDaysToSummaries(metricRows) : fallbackRows;
}

export function buildDashboardMonthOptions(lang: string) {
  const names = lang === 'ar' ? DASHBOARD_MONTH_NAMES_AR : DASHBOARD_MONTH_NAMES_EN;
  return names.map((label, index) => ({
    value: index + 1,
    label,
  }));
}

export function dashboardMonthName(lang: string, month: number | null | undefined): string {
  if (month == null || month < 1 || month > 12) return '';
  const names = lang === 'ar' ? DASHBOARD_MONTH_NAMES_AR : DASHBOARD_MONTH_NAMES_EN;
  return names[month - 1] ?? '';
}

export function buildDashboardKpiCardSeeds(params: {
  monthName: string | null;
  t: DashboardTranslate;
}) {
  const { monthName, t } = params;
  const periodLabel = (base: string) => (monthName ? `${base} - ${monthName}` : base);

  return [
    {
      key: 'sales',
      label: monthName ? periodLabel(t('revenueGroup')) : t('annualSales'),
      formulaKey: 'dashboardKpiFormulaSales',
      pctLabelKey: 'dashboardKpiPctSales',
    },
    {
      key: 'purchases',
      label: monthName ? periodLabel(t('purchasesGroup')) : t('annualPurchases'),
      formulaKey: 'dashboardKpiFormulaPurchases',
      pctLabelKey: 'purchasesToSalesRatio',
    },
    {
      key: 'grossProfit',
      label: periodLabel(t('annualGrossProfit')),
      formulaKey: 'dashboardKpiFormulaGrossProfit',
      pctLabelKey: 'dashboardKpiPctGrossProfit',
    },
    {
      key: 'expenses',
      label: monthName ? periodLabel(t('expensesGroup')) : t('annualExpenses'),
      formulaKey: 'dashboardKpiFormulaExpenses',
      pctLabelKey: 'expensesToSalesRatio',
    },
    {
      key: 'netProfit',
      label: t('annualNetProfit'),
      formulaKey: 'dashboardKpiFormulaNetProfit',
      pctLabelKey: 'dashboardKpiPctNetProfit',
    },
  ];
}

export function mapDashboardTimelineRowsForDisplay(params: {
  rows: readonly DashboardTimelineMetricRow[] | null | undefined;
  lang: string;
  t: DashboardTranslate;
  enMonths: readonly string[];
}): Record<string, string | number>[] {
  const { rows, lang, t, enMonths } = params;
  const salesKey = t('annualSales');
  const purchasesKey = t('annualPurchases');
  const expensesKey = t('annualExpenses');
  const customersKey = t('dashboardTimelineCustomers');
  const avgInvoiceKey = t('dashboardTimelineAvgInvoice');

  return (rows ?? []).map((row) => {
    const month = Number(row.label);
    const label =
      Number.isInteger(month) && month >= 1 && month <= 12 && rows?.length === 12
        ? lang === 'ar'
          ? DASHBOARD_MONTH_NAMES_AR[month - 1]
          : enMonths[month - 1]
        : row.label;
    return {
      label,
      [salesKey]: Number(row.sales || 0),
      [purchasesKey]: Number(row.purchases || 0),
      [expensesKey]: Number(row.expenses || 0),
      [customersKey]: Number(row.customers || 0),
      [avgInvoiceKey]: Number(row.avgInvoice || 0),
    };
  });
}

export function buildDashboardTimelineSeries(params: {
  salesSeries: string;
  purchasesSeries: string;
  expensesSeries: string;
  isAnnualChart: boolean;
  t: DashboardTranslate;
}) {
  const { salesSeries, purchasesSeries, expensesSeries, isAnnualChart, t } = params;
  return [
    {
      key: salesSeries,
      label: t('annualSales'),
      color: KPI_RECHARTS_COLORS.sales,
      gradId: 'gradSales',
      disabled: false,
    },
    {
      key: purchasesSeries,
      label: t('annualPurchases'),
      color: KPI_RECHARTS_COLORS.purchases,
      gradId: 'gradPurch',
      disabled: !isAnnualChart,
    },
    {
      key: expensesSeries,
      label: t('annualExpenses'),
      color: KPI_RECHARTS_COLORS.expenses,
      gradId: 'gradExp',
      disabled: !isAnnualChart,
    },
  ];
}
