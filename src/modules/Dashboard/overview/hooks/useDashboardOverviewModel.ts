import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useDashboardOverview } from '../../../../hooks/useDashboardOverview';
import { useDashboardSalesPack } from '../../../../hooks/useDashboardSalesPack';
import { monthDateBounds } from '../../../../utils/reportDrillLinks';
import { buildKpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { EN_MONTHS } from '../../../Reports/reportHelpers';
import { KPI_RECHARTS_COLORS, VAULT_RECHARTS_COLORS } from '../../../../constants/kpiCardTheme';
import { useUiDir } from '../../../../hooks/useUiDir';
import { getSaudiNow, getSaudiYearMonth } from '../../../../utils/saudiDate';
import { lastDayOfMonth, prevCalendarMonth, ymd } from '../utils/dashboardOverviewDateUtils';
import {
  buildChannelPieRows,
  buildPerformanceRows,
  buildPurchaseCategoriesData,
  buildTopSuppliersChartData,
  buildYearMonthlyDailyAvgRowsFromBackend,
  filterSalesThroughDay,
  revenueMtdEndDay as getRevenueMtdEndDay,
  mergePurchaseCategoriesOthers,
  performanceTotalForSalesKey,
  yearMonthlyDailyAvgCapMonth,
} from '../utils/dashboardOverviewBuilders';
import { computeSalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';
import { buildDashboardWeeklySalesComparisonRowsFromDaily } from '../utils/dashboardWeeklySalesComparisonModel';
import type { DashboardOverviewFilter } from '../types';
import type { DashboardSalesMetricChannel, DashboardSalesMetricDay, DashboardSalesSummary } from '../../../../types/api/domains/dashboard';

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

function metricChannelsToSummaries(rows: readonly DashboardSalesMetricChannel[] | null | undefined): DashboardSalesSummary[] {
  return (rows ?? []).map((row, index) => ({
    id: `metric-channel-${row.periodKey}-${row.vaultId}-${index}`,
    transactionDate: `${row.periodKey}-01`,
    totalAmount: row.amount,
    customerCount: 0,
    channels: [
      {
        amount: row.amount,
        vault: {
          id: row.vaultId,
          nameAr: row.nameAr,
          nameEn: row.nameEn ?? null,
          name: row.nameAr || row.nameEn || row.vaultId,
        },
      },
    ],
  }));
}

function pickMetricSummaries(
  metricRows: readonly DashboardSalesMetricDay[] | null | undefined,
  fallbackRows: DashboardSalesSummary[],
): DashboardSalesSummary[] {
  return metricRows && metricRows.length > 0 ? metricDaysToSummaries(metricRows) : fallbackRows;
}

function salesSummaryTotal(rows: readonly DashboardSalesSummary[]): number {
  return rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
}

function periodKindTotal(
  periodData: { totalsByKind?: Record<string, { totalAmount?: string | number | null }> } | null | undefined,
  kinds: readonly string[],
): number {
  return kinds.reduce((sum, kind) => sum + Number(periodData?.totalsByKind?.[kind]?.totalAmount || 0), 0);
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
    selectedMonth,
    includeCancelledSales: modelOptions?.includeCancelledSales === true,
    enabled: !!companyId,
  });

  const report = overviewData.report;
  const salesMetrics = overviewData.salesPack.metrics;
  const dailySummaries = pickMetricSummaries(salesMetrics?.dailyDaily, overviewData.salesPack.dailySummaries);
  const yearSummaries = pickMetricSummaries(salesMetrics?.yearDaily, overviewData.salesPack.yearSummaries);
  const monthSalesForDailyAvg = pickMetricSummaries(salesMetrics?.monthDaily, overviewData.salesPack.monthSummaries);
  const channelYearSummaries = salesMetrics?.yearChannels?.length
    ? metricChannelsToSummaries(salesMetrics.yearChannels)
    : overviewData.salesPack.yearSummaries;
  const channelDailySummaries = salesMetrics?.dailyChannels?.length
    ? metricChannelsToSummaries(salesMetrics.dailyChannels)
    : overviewData.salesPack.dailySummaries;
  const periodData = overviewData.periodData;
  const reportForDisplay = useMemo(() => {
    if (!isCustomRange) return report;
    const sales = salesSummaryTotal(dailySummaries);
    const purchases = periodKindTotal(periodData, ['purchase']);
    const expenses = periodKindTotal(periodData, ['expense', 'fixed_expense', 'hr_expense']);
    const grossProfit = sales - purchases;
    const netProfit = grossProfit - expenses;
    return {
      ...report,
      cards: {
        ...(report?.cards ?? {}),
        sales,
        purchases,
        expenses,
        grossProfit,
        netProfit,
      },
    };
  }, [dailySummaries, isCustomRange, periodData, report]);

  const kpiInsightFooters = useMemo(
    () =>
      buildKpiInsightFooterMap(
        overviewData.insights ?? undefined,
        isError,
        t,
        lang === 'ar',
        reportForDisplay,
        selectedMonth,
      ),
    [overviewData.insights, isError, t, lang, reportForDisplay, selectedMonth],
  );

  // ─── حزمتا المقارنة الأسبوعية — تبقيان منفصلتين لأنهما تفاعليتان ───
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
  const weeklyPackYearSpanB = useMemo(
    () => ({ yearStart: `${weeklyPanelYearB}-01-01`, yearEnd: `${weeklyPanelYearB}-12-31` }),
    [weeklyPanelYearB],
  );

  const { metrics: weeklyMetricsA, isLoading: weeklyPackALoading } = useDashboardSalesPack({
    companyId,
    yearStart: weeklyPackYearSpanA.yearStart,
    yearEnd: weeklyPackYearSpanA.yearEnd,
    dailyStart: weeklyBoundsA.start,
    dailyEnd: weeklyBoundsA.end,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

  const { metrics: weeklyMetricsB, isLoading: weeklyPackBLoading } = useDashboardSalesPack({
    companyId,
    yearStart: weeklyPackYearSpanB.yearStart,
    yearEnd: weeklyPackYearSpanB.yearEnd,
    dailyStart: weeklyBoundsB.start,
    dailyEnd: weeklyBoundsB.end,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

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

  const { monthSummaries: prevMonthRowsForDailyAvg, metrics: prevMonthMetrics } = useDashboardSalesPack({
    companyId,
    yearStart: prevMonthPackYearSpan?.yearStart ?? `${year}-01-01`,
    yearEnd: prevMonthPackYearSpan?.yearEnd ?? `${year}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart: prevMonthSalesAvgBounds.start,
    monthEnd: prevMonthSalesAvgBounds.end,
    enabled: !!companyId && selectedMonth != null && !!prevMonthSalesAvgBounds.start,
  });
  const prevMonthSalesForDailyAvg = pickMetricSummaries(prevMonthMetrics?.monthDaily, prevMonthRowsForDailyAvg);
  const monthAverageForDailyAvg = salesMetrics?.monthAverage;
  const prevMonthAverageForDailyAvg = prevMonthMetrics?.monthAverage;

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

  const monthSalesThroughMtd = useMemo(() => {
    if (selectedMonth == null || revenueMtdEndDay <= 0) return monthSalesForDailyAvg;
    return filterSalesThroughDay(monthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay);
  }, [monthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay]);

  const prevMonthSalesThroughMtd = useMemo(() => {
    if (selectedMonth == null || revenueMtdEndDay <= 0) return prevMonthSalesForDailyAvg;
    const prev = prevCalendarMonth(year, selectedMonth);
    return filterSalesThroughDay(
      prevMonthSalesForDailyAvg,
      prev.year,
      prev.month,
      revenueMtdEndDay,
    );
  }, [prevMonthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay]);

  const salesShiftPeriodTotals = useMemo(() => {
    if (isCustomRange) return computeSalesShiftPeriodTotals(dailySummaries);
    if (selectedMonth == null) return computeSalesShiftPeriodTotals(yearSummaries);
    const src =
      revenueMtdEndDay > 0 ? monthSalesThroughMtd : monthSalesForDailyAvg;
    return computeSalesShiftPeriodTotals(src);
  }, [
    isCustomRange,
    dailySummaries,
    selectedMonth,
    yearSummaries,
    monthSalesForDailyAvg,
    monthSalesThroughMtd,
    revenueMtdEndDay,
  ]);

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
    () =>
      buildPerformanceRows({
        report: reportForDisplay,
        timelineGrain,
        dailySummaries,
        yearSummaries,
        lastDayChart,
        lang,
        t,
        monthNamesAr: MONTH_NAMES_AR,
        enMonths: EN_MONTHS,
      }),
    [reportForDisplay, timelineGrain, dailySummaries, yearSummaries, lastDayChart, lang, t],
  );

  const channelPeriodLabel = useMemo(() => {
    if (filter?.label) return filter.label;
    if (selectedMonth != null && monthName) return `${monthName} ${year}`;
    return String(year);
  }, [filter?.label, selectedMonth, monthName, year]);

  const channelData = useMemo(
    () =>
      buildChannelPieRows({
        yearSummaries: channelYearSummaries,
        dailySummaries: channelDailySummaries,
        selectedMonth: isCustomRange ? 1 : selectedMonth,
        lang,
      }),
    [channelYearSummaries, channelDailySummaries, isCustomRange, selectedMonth, lang],
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

  const weeklySalesWeekRows = useMemo(() => {
    const isSelectedPeriod =
      selectedMonth != null &&
      weeklyPanelYearA === year &&
      weeklyPanelMonthA === selectedMonth &&
      revenueMtdEndDay > 0;
    const isCurrentCalendarMonth =
      weeklyPanelYearA === saudiNow.year && weeklyPanelMonthA === saudiNow.month;
    const currentMaxDayInclusive = isSelectedPeriod
      ? revenueMtdEndDay
      : isCurrentCalendarMonth
        ? saudiNow.day
        : undefined;

    return buildDashboardWeeklySalesComparisonRowsFromDaily({
      current: weeklyMetricsA?.dailyDaily,
      baseline: weeklyMetricsB?.dailyDaily,
      currentYear: weeklyPanelYearA,
      currentMonth: weeklyPanelMonthA,
      baselineYear: weeklyPanelYearB,
      baselineMonth: weeklyPanelMonthB,
      currentMaxDayInclusive,
    });
  }, [
    selectedMonth,
    weeklyPanelYearA,
    weeklyPanelMonthA,
    weeklyPanelYearB,
    weeklyPanelMonthB,
    year,
    revenueMtdEndDay,
    saudiNow.year,
    saudiNow.month,
    saudiNow.day,
    weeklyMetricsA?.dailyDaily,
    weeklyMetricsB?.dailyDaily,
  ]);

  const weeklySalesPanelLoading = weeklyPackALoading || weeklyPackBLoading;

  return {
    t,
    lang,
    uiDir,
    report: reportForDisplay,
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
