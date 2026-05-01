import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useReportsGeneralProfitLoss, usePeriodAnalytics } from '../../../../hooks/useReports';
import { monthDateBounds } from '../../../../utils/reportDrillLinks';
import { useDashboardSalesPack } from '../../../../hooks/useDashboardSalesPack';
import { useDashboardInsights } from '../../hooks/useDashboardInsights';
import { buildKpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
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
import { getCardValue, type PlReportLike } from '../utils/dashboardOverviewCalculations';
import { avgWeeklySalesFromMonthTotal, pctChangeVsBaseline } from '../utils/dashboardWeeklySales';
import type { DashboardOverviewFilter } from '../types';

/** خيارات اختيارية — تستخدمها شاشة الاستوديو فقط (لا تغيّر اللوحة التقليدية). */
export type UseDashboardOverviewModelOptions = {
  /** يمرّر لـ GET رؤى لوحة التحكم — يؤثر على مفتاح الاستعلام */
  includeCancelledSales?: boolean;
};

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
  modelOptions?: UseDashboardOverviewModelOptions,
) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const { data: reportPrevYear, isLoading: isPrevYearReportLoading } = useReportsGeneralProfitLoss({
    companyId,
    year: year - 1,
    enabled: !!companyId && selectedMonth != null && year > 1900,
  });

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));
  const [weeklySalesCompareMode, setWeeklySalesCompareMode] = useState<'mom' | 'yoy'>('mom');

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
    includeCancelledSales: modelOptions?.includeCancelledSales === true,
    enabled: !!companyId,
  });

  const kpiInsightFooters = useMemo(
    () => buildKpiInsightFooterMap(insightsQuery.data, insightsQuery.isError, t, lang === 'ar'),
    [insightsQuery.data, insightsQuery.isError, t, lang],
  );

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

  const weeklySalesComparison = useMemo(() => {
    if (selectedMonth == null || !report) return null;

    const curTotal = Number(getCardValue(report, 'sales', selectedMonth) || 0);
    const currentWeekly = avgWeeklySalesFromMonthTotal(curTotal, year, selectedMonth);

    const needsPrevYear = weeklySalesCompareMode === 'yoy' || selectedMonth === 1;
    if (needsPrevYear && !reportPrevYear) return null;

    let baseTotal = 0;
    let baseYear = year;
    let baseMonth = selectedMonth;

    if (weeklySalesCompareMode === 'mom') {
      if (selectedMonth >= 2) {
        baseTotal = Number(getCardValue(report, 'sales', selectedMonth - 1) || 0);
        baseYear = year;
        baseMonth = selectedMonth - 1;
      } else {
        baseTotal = Number(getCardValue(reportPrevYear as PlReportLike, 'sales', 12) || 0);
        baseYear = year - 1;
        baseMonth = 12;
      }
    } else {
      baseTotal = Number(getCardValue(reportPrevYear as PlReportLike, 'sales', selectedMonth) || 0);
      baseYear = year - 1;
      baseMonth = selectedMonth;
    }

    const baselineWeekly = avgWeeklySalesFromMonthTotal(baseTotal, baseYear, baseMonth);
    const deltaPct = pctChangeVsBaseline(currentWeekly, baselineWeekly);

    const baselineLabel =
      lang === 'ar'
        ? `${MONTH_NAMES_AR[baseMonth - 1]} ${baseYear}`
        : `${MONTH_NAMES_EN[baseMonth - 1]} ${baseYear}`;

    return {
      currentWeekly,
      baselineWeekly,
      deltaPct,
      baselineLabel,
    };
  }, [report, reportPrevYear, selectedMonth, year, weeklySalesCompareMode, lang]);

  const weeklySalesComparisonLoading =
    selectedMonth != null &&
    (isLoading || (((weeklySalesCompareMode === 'yoy' || selectedMonth === 1) && isPrevYearReportLoading)));

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
    kpiInsightFooters,
    dashboardInsights: {
      data: insightsQuery.data,
      isLoading: insightsQuery.isLoading,
      isError: insightsQuery.isError,
    },
    weeklySalesCompareMode,
    setWeeklySalesCompareMode,
    weeklySalesComparison,
    weeklySalesComparisonLoading,
  };
}

export { MONTH_NAMES_AR, MONTH_NAMES_EN, PIE_COLORS };

export type DashboardOverviewModel = ReturnType<typeof useDashboardOverviewModel>;
