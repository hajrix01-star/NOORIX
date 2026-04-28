import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useReportsGeneralProfitLoss, usePeriodAnalytics } from '../../../../hooks/useReports';
import { monthDateBounds } from '../../../../utils/reportDrillLinks';
import { useDashboardSalesPack } from '../../../../hooks/useDashboardSalesPack';
import { useDashboardInsights } from '../../hooks/useDashboardInsights';
import { pickDashboardInsightDisplayItems } from '../utils/dashboardOverviewInsightsPick';
import type { DashboardInsightsUi } from '../types/dashboardInsightsDisplay';
import { EN_MONTHS } from '../../../Reports/reportHelpers';
import { KPI_RECHARTS_COLORS, VAULT_RECHARTS_COLORS } from '../../../../constants/kpiCardTheme';
import { useUiDir } from '../../../../hooks/useUiDir';
import { getSaudiYearMonth } from '../../../../utils/saudiDate';
import { lastDayOfMonth, ymd } from '../utils/dashboardOverviewDateUtils';
import {
  buildChannelPieRows,
  buildPerformanceRows,
  buildPurchaseCategoriesData,
  buildTopSuppliersChartData,
  computeRevenueDailyAvgActiveDays,
  mergePurchaseCategoriesOthers,
  performanceTotalForSalesKey,
} from '../utils/dashboardOverviewBuilders';
import type { DashboardOverviewFilter } from '../types';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PIE_COLORS = [
  VAULT_RECHARTS_COLORS.bank,
  VAULT_RECHARTS_COLORS.cash,
  VAULT_RECHARTS_COLORS.app,
  KPI_RECHARTS_COLORS.netProfit,
  KPI_RECHARTS_COLORS.expenses,
  KPI_RECHARTS_COLORS.purchases,
  '#0891b2',
  '#db2777',
];

export function useDashboardOverviewModel(
  companyId: string,
  year: number,
  selectedMonth: number | null,
  filter: DashboardOverviewFilter | undefined,
) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));

  const saudiYM = getSaudiYearMonth();
  const chartMonthForDaily =
    selectedMonth != null ? selectedMonth : year === saudiYM.year ? saudiYM.month : 1;
  const lastDayChart = lastDayOfMonth(year, chartMonthForDaily);
  const dailyStart = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, 1) : null;
  const dailyEnd = timelineGrain === 'daily' ? ymd(year, chartMonthForDaily, lastDayChart) : null;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const monthSalesAvgBounds = useMemo(() => {
    if (selectedMonth == null) return { start: null, end: null };
    const ld = lastDayOfMonth(year, selectedMonth);
    return { start: ymd(year, selectedMonth, 1), end: ymd(year, selectedMonth, ld) };
  }, [year, selectedMonth]);

  const {
    dailySummaries,
    yearSummaries,
    monthSummaries: monthSalesForDailyAvg,
    isLoading: salesPackLoading,
  } = useDashboardSalesPack({
    companyId,
    yearStart,
    yearEnd,
    dailyStart: timelineGrain === 'daily' ? dailyStart : null,
    dailyEnd: timelineGrain === 'daily' ? dailyEnd : null,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    enabled: !!companyId,
  });

  const revenueDailyAvgActiveDays = useMemo(
    () => computeRevenueDailyAvgActiveDays(monthSalesForDailyAvg),
    [monthSalesForDailyAvg],
  );

  const { from: supplierFrom, to: supplierTo } = useMemo(
    () => monthDateBounds(year, selectedMonth ?? null),
    [year, selectedMonth],
  );

  const insightsQuery = useDashboardInsights({
    companyId,
    year,
    yearStart,
    yearEnd,
    dailyStart,
    dailyEnd,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    periodStart: supplierFrom,
    periodEnd: supplierTo,
    selectedMonth: selectedMonth ?? undefined,
    enabled: !!companyId,
  });

  const insightDisplayRows = useMemo(
    () => pickDashboardInsightDisplayItems(insightsQuery.data),
    [insightsQuery.data],
  );

  const insightsUi = useMemo((): DashboardInsightsUi => {
    if (insightsQuery.isError) return { show: false };
    if (insightDisplayRows.length > 0) return { show: true, state: 'ready', items: insightDisplayRows };
    if (insightsQuery.isPending) return { show: true, state: 'loading' };
    return { show: false };
  }, [insightDisplayRows, insightsQuery.isError, insightsQuery.isPending]);

  const { data: periodData, isLoading: isPeriodLoading } = usePeriodAnalytics({
    companyId,
    startDate: supplierFrom,
    endDate: supplierTo,
    enabled: !!companyId,
  });

  const monthName = selectedMonth
    ? lang === 'ar'
      ? MONTH_NAMES_AR[selectedMonth - 1]
      : MONTH_NAMES_EN[selectedMonth - 1]
    : null;

  const cards = useMemo(
    () => [
      {
        key: 'sales',
        label: monthName ? `${t('revenueGroup')} — ${monthName}` : t('annualSales'),
        formulaKey: 'dashboardKpiFormulaSales',
        pctLabelKey: 'dashboardKpiPctSales',
      },
      {
        key: 'purchases',
        label: monthName ? `${t('purchasesGroup')} — ${monthName}` : t('annualPurchases'),
        formulaKey: 'dashboardKpiFormulaPurchases',
        pctLabelKey: 'purchasesToSalesRatio',
      },
      {
        key: 'expenses',
        label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),
        formulaKey: 'dashboardKpiFormulaExpenses',
        pctLabelKey: 'expensesToSalesRatio',
      },
      {
        key: 'grossProfit',
        label: t('annualGrossProfit'),
        formulaKey: 'dashboardKpiFormulaGrossProfit',
        pctLabelKey: 'dashboardKpiPctGrossProfit',
      },
      {
        key: 'netProfit',
        label: t('annualNetProfit'),
        formulaKey: 'dashboardKpiFormulaNetProfit',
        pctLabelKey: 'dashboardKpiPctNetProfit',
      },
    ],
    [monthName, t],
  );

  const performanceData = useMemo(
    () =>
      buildPerformanceRows({
        report,
        timelineGrain,
        dailySummaries,
        lastDayChart,
        lang,
        t,
        monthNamesAr: MONTH_NAMES_AR,
        enMonths: EN_MONTHS,
      }),
    [report, timelineGrain, dailySummaries, lastDayChart, lang, t],
  );

  const channelData = useMemo(
    () =>
      buildChannelPieRows({
        yearSummaries,
        dailySummaries,
        timelineGrain,
        lang,
      }),
    [yearSummaries, dailySummaries, timelineGrain, lang],
  );

  const salesSeries = t('annualSales');
  const purchSeries = t('annualPurchases');
  const expSeries = t('annualExpenses');
  const isAnnualChart = timelineGrain === 'monthly';

  const perfTotal = useMemo(
    () => performanceTotalForSalesKey(performanceData as Record<string, string | number>[], salesSeries),
    [performanceData, salesSeries],
  );

  const topSuppliersChartData = useMemo(
    () => buildTopSuppliersChartData(periodData, lang, PIE_COLORS),
    [periodData, lang],
  );

  const purchaseCategoriesData = useMemo(
    () => buildPurchaseCategoriesData(periodData, lang, PIE_COLORS),
    [periodData, lang],
  );

  const purchaseCategoriesPieData = useMemo(
    () => mergePurchaseCategoriesOthers(purchaseCategoriesData, t('dashboardPurchasesByCategoryOthers'), PIE_COLORS),
    [purchaseCategoriesData, t],
  );

  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const SERIES = useMemo(
    () => [
      { key: salesSeries, label: t('annualSales'), color: KPI_RECHARTS_COLORS.sales, gradId: 'gradSales', disabled: false },
      {
        key: purchSeries,
        label: t('annualPurchases'),
        color: KPI_RECHARTS_COLORS.purchases,
        gradId: 'gradPurch',
        disabled: !isAnnualChart,
      },
      {
        key: expSeries,
        label: t('annualExpenses'),
        color: KPI_RECHARTS_COLORS.expenses,
        gradId: 'gradExp',
        disabled: !isAnnualChart,
      },
    ],
    [salesSeries, purchSeries, expSeries, isAnnualChart, t],
  );

  const timelineMonthName =
    lang === 'ar' ? MONTH_NAMES_AR[chartMonthForDaily - 1] : MONTH_NAMES_EN[chartMonthForDaily - 1];

  return {
    t,
    lang,
    uiDir,
    report,
    isLoading,
    error,
    salesPackLoading,
    timelineGrain,
    setTimelineGrain,
    chartMonthForDaily,
    lastDayChart,
    supplierFrom,
    supplierTo,
    isPeriodLoading,
    periodData,
    cards,
    performanceData,
    channelData,
    perfTotal,
    topSuppliersChartData,
    purchaseCategoriesPieData,
    revenueDailyAvgActiveDays,
    hiddenSeries,
    toggleSeries,
    SERIES,
    timelineMonthName,
    filter,
    year,
    selectedMonth,
    pieColors: PIE_COLORS,
    insightsUi,
  };
}

export { MONTH_NAMES_AR, MONTH_NAMES_EN, PIE_COLORS };
