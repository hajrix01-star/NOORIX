import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useDashboardOverview } from '../../../../hooks/useDashboardOverview';
import { monthDateBounds } from '../../../../utils/reportDrillLinks';
import { buildKpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { EN_MONTHS } from '../../../Reports/reportHelpers';
import { KPI_RECHARTS_COLORS, VAULT_RECHARTS_COLORS } from '../../../../constants/kpiCardTheme';
import { useUiDir } from '../../../../hooks/useUiDir';
import { getSaudiNow, getSaudiYearMonth } from '../../../../utils/saudiDate';
import { lastDayOfMonth, prevCalendarMonth, ymd } from '../utils/dashboardOverviewDateUtils';
import {
  buildChannelBreakdownRowsFromBackend,
  buildPurchaseCategoriesRowsFromBackend,
  buildTopSuppliersChartRowsFromBackend,
  buildYearMonthlyDailyAvgRowsFromBackend,
  revenueMtdEndDay as getRevenueMtdEndDay,
  performanceTotalForSalesKey,
  yearMonthlyDailyAvgCapMonth,
} from '../utils/dashboardOverviewBuilders';
import type { DashboardOverviewFilter } from '../types';
import type {
  DashboardSalesMetricDay,
  DashboardSalesSummary,
  DashboardKpiCardMetric,
  DashboardTimelineMetricRow,
} from '../../../../types/api/domains/dashboard';

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

function metricDaysToSummaries(rows: readonly DashboardSalesMetricDay[] | null | undefined): DashboardSalesSummary[] {
  return (rows ?? []).map((row, index) => ({
    id: `metric-day-${row.transactionDate}-${row.shift ?? 'all'}-${index}`,
    transactionDate: row.transactionDate,
    totalAmount: row.totalAmount,
    customerCount: row.customerCount,
    channels: [],
  }));
}

function pickMetricSummaries(
  metricRows: readonly DashboardSalesMetricDay[] | null | undefined,
  fallbackRows: DashboardSalesSummary[],
): DashboardSalesSummary[] {
  return metricRows && metricRows.length > 0 ? metricDaysToSummaries(metricRows) : fallbackRows;
}

function mapTimelineRowsForDisplay(params: {
  rows: readonly DashboardTimelineMetricRow[] | null | undefined;
  lang: string;
  t: (key: string) => string;
  monthNamesAr: readonly string[];
  enMonths: readonly string[];
}): Record<string, string | number>[] {
  const { rows, lang, t, monthNamesAr, enMonths } = params;
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
          ? monthNamesAr[month - 1]
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

export function useDashboardOverviewModel(
  companyId: string,
  year: number,
  selectedMonth: number | null,
  filter: DashboardOverviewFilter | undefined,
  modelOptions?: UseDashboardOverviewModelOptions,
) {
  const { t, lang } = useTranslation();
  const uiDir = useUiDir();

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));

  const saInit = getSaudiYearMonth();
  const initPrev = prevCalendarMonth(saInit.year, saInit.month);
  const [weeklyPanelYearA, setWeeklyPanelYearA] = useState(saInit.year);
  const [weeklyPanelMonthA, setWeeklyPanelMonthA] = useState(saInit.month);
  const [weeklyPanelYearB, setWeeklyPanelYearB] = useState(initPrev.year);
  const [weeklyPanelMonthB, setWeeklyPanelMonthB] = useState(initPrev.month);

  useEffect(() => {
    if (selectedMonth == null) return;
    setWeeklyPanelYearA(year);
    setWeeklyPanelMonthA(selectedMonth);
    const p = prevCalendarMonth(year, selectedMonth);
    setWeeklyPanelYearB(p.year);
    setWeeklyPanelMonthB(p.month);
  }, [year, selectedMonth]);

  const weeklyYearOptions = useMemo(() => {
    const sa = getSaudiYearMonth();
    const hi = sa.year + 1;
    const lo = hi - 10;
    return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i);
  }, []);

  const weeklyMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: lang === 'ar' ? MONTH_NAMES_AR[i] : MONTH_NAMES_EN[i],
      })),
    [lang],
  );

  const saudiYM = getSaudiYearMonth();
  const chartMonthForDaily =
    selectedMonth != null ? selectedMonth : year === saudiYM.year ? saudiYM.month : 1;
  const lastDayChart = lastDayOfMonth(year, chartMonthForDaily);

  const dailyStartEffective =
    selectedMonth != null
      ? ymd(year, selectedMonth, 1)
      : timelineGrain === 'daily'
        ? ymd(year, chartMonthForDaily, 1)
        : null;
  const dailyEndEffective =
    selectedMonth != null
      ? ymd(year, selectedMonth, lastDayOfMonth(year, selectedMonth))
      : timelineGrain === 'daily'
        ? ymd(year, chartMonthForDaily, lastDayChart)
        : null;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const isCustomRange = filter?.isCustomRange === true && !!filter.periodStart && !!filter.periodEnd;
  const customPeriodStart = isCustomRange ? String(filter?.periodStart) : null;
  const customPeriodEnd = isCustomRange ? String(filter?.periodEnd) : null;

  const monthSalesAvgBounds = useMemo(() => {
    if (isCustomRange) return { start: customPeriodStart, end: customPeriodEnd };
    if (selectedMonth == null) return { start: null, end: null };
    const ld = lastDayOfMonth(year, selectedMonth);
    return { start: ymd(year, selectedMonth, 1), end: ymd(year, selectedMonth, ld) };
  }, [customPeriodEnd, customPeriodStart, isCustomRange, year, selectedMonth]);

  const prevMonthSalesAvgBounds = useMemo(() => {
    if (selectedMonth == null) return { start: null, end: null, year: null as number | null };
    const prev = prevCalendarMonth(year, selectedMonth);
    const ld = lastDayOfMonth(prev.year, prev.month);
    return {
      start: ymd(prev.year, prev.month, 1),
      end: ymd(prev.year, prev.month, ld),
      year: prev.year,
    };
  }, [year, selectedMonth]);

  const { from: monthSupplierFrom, to: monthSupplierTo } = useMemo(
    () => monthDateBounds(year, selectedMonth ?? null),
    [year, selectedMonth],
  );
  const supplierFrom = customPeriodStart ?? monthSupplierFrom;
  const supplierTo = customPeriodEnd ?? monthSupplierTo;

  const weeklyBoundsA = useMemo(() => {
    const ld = lastDayOfMonth(weeklyPanelYearA, weeklyPanelMonthA);
    return {
      start: ymd(weeklyPanelYearA, weeklyPanelMonthA, 1),
      end: ymd(weeklyPanelYearA, weeklyPanelMonthA, ld),
    };
  }, [weeklyPanelYearA, weeklyPanelMonthA]);

  const weeklyBoundsB = useMemo(() => {
    const ld = lastDayOfMonth(weeklyPanelYearB, weeklyPanelMonthB);
    return {
      start: ymd(weeklyPanelYearB, weeklyPanelMonthB, 1),
      end: ymd(weeklyPanelYearB, weeklyPanelMonthB, ld),
    };
  }, [weeklyPanelYearB, weeklyPanelMonthB]);

  const weeklyPackYearSpanA = useMemo(
    () => ({ yearStart: `${weeklyPanelYearA}-01-01`, yearEnd: `${weeklyPanelYearA}-12-31` }),
    [weeklyPanelYearA],
  );

  const prevMonthPackYearSpan = useMemo(
    () =>
      prevMonthSalesAvgBounds.year != null
        ? {
            yearStart: `${prevMonthSalesAvgBounds.year}-01-01`,
            yearEnd: `${prevMonthSalesAvgBounds.year}-12-31`,
          }
        : null,
    [prevMonthSalesAvgBounds.year],
  );

  // ─── طلب موحّد واحد: P&L + Sales Pack + Insights + Period Analytics ───
  const {
    data: overviewData,
    isLoading,
    isError,
    error,
  } = useDashboardOverview({
    companyId,
    year,
    yearStart,
    yearEnd,
    periodStart: supplierFrom,
    periodEnd: supplierTo,
    dailyStart: customPeriodStart ?? dailyStartEffective,
    dailyEnd: customPeriodEnd ?? dailyEndEffective,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    weeklyYearStart: weeklyPackYearSpanA.yearStart,
    weeklyYearEnd: weeklyPackYearSpanA.yearEnd,
    weeklyStart: weeklyBoundsA.start,
    weeklyEnd: weeklyBoundsA.end,
    weeklyBaselineStart: weeklyBoundsB.start,
    weeklyBaselineEnd: weeklyBoundsB.end,
    previousMonthYearStart: prevMonthPackYearSpan?.yearStart ?? null,
    previousMonthYearEnd: prevMonthPackYearSpan?.yearEnd ?? null,
    previousMonthStart: prevMonthSalesAvgBounds.start,
    previousMonthEnd: prevMonthSalesAvgBounds.end,
    selectedMonth,
    includeCancelledSales: modelOptions?.includeCancelledSales === true,
    enabled: !!companyId,
  });

  const report = overviewData.report;
  const salesMetrics = overviewData.salesPack.metrics;
  const dailySummaries = pickMetricSummaries(salesMetrics?.dailyDaily, overviewData.salesPack.dailySummaries);
  const yearSummaries = pickMetricSummaries(salesMetrics?.yearDaily, overviewData.salesPack.yearSummaries);
  const monthSalesForDailyAvg = pickMetricSummaries(salesMetrics?.monthDaily, overviewData.salesPack.monthSummaries);
  const periodData = overviewData.periodData;
  const kpiInsightFooters = useMemo(
    () =>
      buildKpiInsightFooterMap(
        overviewData.insights ?? undefined,
        isError,
        t,
        lang === 'ar',
        undefined,
        null,
      ),
    [overviewData.insights, isError, t, lang],
  );

  const kpiCardsByKey = useMemo(() => {
    const rows = overviewData.presentation?.kpiCards ?? [];
    return new Map<string, DashboardKpiCardMetric>(rows.map((row) => [row.key, row]));
  }, [overviewData.presentation?.kpiCards]);

  // ─── حزمتا المقارنة الأسبوعية — تبقيان منفصلتين لأنهما تفاعليتان ───
  const monthAverageForDailyAvg = salesMetrics?.monthAverage;
  const prevMonthAverageForDailyAvg = overviewData.presentation?.previousMonthAverage ?? null;

  const saudiNow = getSaudiNow();

  const revenueMtdEndDay = useMemo(() => {
    if (selectedMonth == null) return 0;
    return getRevenueMtdEndDay(
      year,
      selectedMonth,
      saudiNow.year,
      saudiNow.month,
      saudiNow.day,
      monthSalesForDailyAvg,
    );
  }, [year, selectedMonth, saudiNow.year, saudiNow.month, saudiNow.day, monthSalesForDailyAvg]);

  const salesShiftPeriodTotals = salesMetrics?.shiftTotals ?? null;

  const yearlyDailyAvgRows = useMemo(() => {
    const capMonth = yearMonthlyDailyAvgCapMonth(year, saudiYM.year, saudiYM.month);
    const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;

    return buildYearMonthlyDailyAvgRowsFromBackend({
      year,
      rows: salesMetrics?.yearMonthlyDailyAverages,
      monthNames,
      capMonth,
      currentYear: saudiYM.year,
      currentMonth: saudiYM.month,
    });
  }, [year, salesMetrics?.yearMonthlyDailyAverages, lang, saudiYM.year, saudiYM.month]);

  const monthName = isCustomRange
    ? filter?.label ?? null
    : selectedMonth
      ? lang === 'ar'
        ? MONTH_NAMES_AR[selectedMonth - 1]
        : MONTH_NAMES_EN[selectedMonth - 1]
      : null;

  const prevMonthName = useMemo(() => {
    if (selectedMonth == null) return '';
    const prev = prevCalendarMonth(year, selectedMonth);
    return lang === 'ar'
      ? MONTH_NAMES_AR[prev.month - 1]
      : MONTH_NAMES_EN[prev.month - 1];
  }, [year, selectedMonth, lang]);

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
        key: 'grossProfit',
        label: monthName ? `${t('annualGrossProfit')} — ${monthName}` : t('annualGrossProfit'),
        formulaKey: 'dashboardKpiFormulaGrossProfit',
        pctLabelKey: 'dashboardKpiPctGrossProfit',
      },
      {
        key: 'expenses',
        label: monthName ? `${t('expensesGroup')} — ${monthName}` : t('annualExpenses'),
        formulaKey: 'dashboardKpiFormulaExpenses',
        pctLabelKey: 'expensesToSalesRatio',
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
    () => {
      const timelineRows =
        timelineGrain === 'daily'
          ? overviewData.presentation?.timeline?.daily
          : overviewData.presentation?.timeline?.monthly;
      return mapTimelineRowsForDisplay({
        rows: timelineRows,
        lang,
        t,
        monthNamesAr: MONTH_NAMES_AR,
        enMonths: EN_MONTHS,
      });
    },
    [overviewData.presentation?.timeline?.daily, overviewData.presentation?.timeline?.monthly, timelineGrain, lang, t],
  );

  const channelPeriodLabel = useMemo(() => {
    if (filter?.label) return filter.label;
    if (selectedMonth != null && monthName) return `${monthName} ${year}`;
    return String(year);
  }, [filter?.label, selectedMonth, monthName, year]);

  const channelData = useMemo(
    () =>
      buildChannelBreakdownRowsFromBackend({
        rows: salesMetrics?.channelBreakdown,
        lang,
      }),
    [salesMetrics?.channelBreakdown, lang],
  );

  const salesSeries = t('annualSales');
  const purchSeries = t('annualPurchases');
  const expSeries = t('annualExpenses');
  const isAnnualChart = timelineGrain === 'monthly';

  const perfTotal = useMemo(
    () => performanceTotalForSalesKey(performanceData, salesSeries),
    [performanceData, salesSeries],
  );

  const topSuppliersChartData = useMemo(
    () => buildTopSuppliersChartRowsFromBackend(periodData, lang, PIE_COLORS),
    [periodData, lang],
  );

  const purchaseCategoriesPieData = useMemo(
    () => buildPurchaseCategoriesRowsFromBackend(periodData, lang, PIE_COLORS),
    [periodData, lang],
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

  const weeklySalesWeekRows = useMemo(
    () => ({ rows: overviewData.presentation?.weeklyComparison ?? [] }),
    [overviewData.presentation?.weeklyComparison],
  );

  const weeklySalesPanelLoading = isLoading;

  return {
    t,
    lang,
    uiDir,
    report,
    isLoading,
    isError,
    error,
    // salesPackLoading محذوف — الآن مندمج في isLoading الموحّد
    salesPackLoading: false,
    timelineGrain,
    setTimelineGrain,
    chartMonthForDaily,
    lastDayChart,
    supplierFrom,
    supplierTo,
    isPeriodLoading: isLoading,
    periodData,
    cards,
    kpiCardsByKey,
    performanceData,
    channelData,
    perfTotal,
    topSuppliersChartData,
    purchaseCategoriesPieData,
    revenueMtdEndDay,
    revenueDailyAvgCalendar: selectedMonth != null ? monthAverageForDailyAvg?.revenueAvgDaily ?? null : null,
    revenueDailyAvgPrevMonthCalendar: selectedMonth != null ? prevMonthAverageForDailyAvg?.revenueAvgDaily ?? null : null,
    revenueMtdTotalSum: selectedMonth != null ? monthAverageForDailyAvg?.total ?? 0 : 0,
    revenuePrevMonthTotalSum: selectedMonth != null ? prevMonthAverageForDailyAvg?.total ?? 0 : 0,
    monthName,
    prevMonthName,
    customerDailyAvgCalendar: selectedMonth != null ? monthAverageForDailyAvg?.customerAvgDaily ?? null : null,
    customerDailyAvgPrevMonthCalendar: selectedMonth != null ? prevMonthAverageForDailyAvg?.customerAvgDaily ?? null : null,
    salesShiftPeriodTotals,
    yearlyDailyAvgRows,
    hiddenSeries,
    toggleSeries,
    SERIES,
    timelineMonthName,
    channelPeriodLabel,
    filter,
    year,
    selectedMonth,
    pieColors: PIE_COLORS,
    kpiInsightFooters,
    dashboardInsights: {
      data: overviewData.insights,
      isLoading: false,
      isError,
    },
    weeklyPanelYearA,
    setWeeklyPanelYearA,
    weeklyPanelMonthA,
    setWeeklyPanelMonthA,
    weeklyPanelYearB,
    setWeeklyPanelYearB,
    weeklyPanelMonthB,
    setWeeklyPanelMonthB,
    weeklyYearOptions,
    weeklyMonthOptions,
    weeklySalesWeekRows,
    weeklySalesPanelLoading,
  };
}

export { MONTH_NAMES_AR, MONTH_NAMES_EN, PIE_COLORS };

export type DashboardOverviewModel = ReturnType<typeof useDashboardOverviewModel>;
