import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useDashboardOverview } from '../../../../hooks/useDashboardOverview';
import { monthDateBounds } from '../../../../utils/reportDrillLinks';
import { buildKpiInsightFooterMap } from '../utils/dashboardOverviewKpiInsightFooters';
import { EN_MONTHS } from '../../../Reports/reportHelpers';
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
import {
  DASHBOARD_MONTH_NAMES_AR,
  DASHBOARD_MONTH_NAMES_EN,
  DASHBOARD_PIE_COLORS,
  buildDashboardKpiCardSeeds,
  buildDashboardTimelineSeries,
  dashboardMonthName,
  mapDashboardTimelineRowsForDisplay,
  pickMetricSummaries,
} from '../utils/dashboardOverviewPresentationModel';
import { useDashboardWeeklyComparisonState } from './useDashboardWeeklyComparisonState';
import type { DashboardOverviewFilter } from '../types';
import type {
  DashboardKpiCardMetric,
} from '../../../../types/api/domains/dashboard';

/** خيارات اختيارية — تستخدمها شاشة الاستوديو فقط (لا تغيّر اللوحة التقليدية). */
export type UseDashboardOverviewModelOptions = {
  /** يمرّر لـ GET رؤى لوحة التحكم — يؤثر على مفتاح الاستعلام */
  includeCancelledSales?: boolean;
};

const MONTH_NAMES_AR = DASHBOARD_MONTH_NAMES_AR;
const MONTH_NAMES_EN = DASHBOARD_MONTH_NAMES_EN;
const PIE_COLORS = DASHBOARD_PIE_COLORS;

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

  const weeklyState = useDashboardWeeklyComparisonState({ year, selectedMonth, lang });

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
    weeklyYearStart: weeklyState.yearSpanA.yearStart,
    weeklyYearEnd: weeklyState.yearSpanA.yearEnd,
    weeklyStart: weeklyState.boundsA.start,
    weeklyEnd: weeklyState.boundsA.end,
    weeklyBaselineStart: weeklyState.boundsB.start,
    weeklyBaselineEnd: weeklyState.boundsB.end,
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
      ? dashboardMonthName(lang, selectedMonth)
      : null;

  const prevMonthName = useMemo(() => {
    if (selectedMonth == null) return '';
    const prev = prevCalendarMonth(year, selectedMonth);
    return dashboardMonthName(lang, prev.month);
  }, [year, selectedMonth, lang]);

  const cards = useMemo(
    () => buildDashboardKpiCardSeeds({ monthName, t }),
    [monthName, t],
  );

  const performanceData = useMemo(
    () => {
      const timelineRows =
        timelineGrain === 'daily'
          ? overviewData.presentation?.timeline?.daily
          : overviewData.presentation?.timeline?.monthly;
      return mapDashboardTimelineRowsForDisplay({
        rows: timelineRows,
        lang,
        t,
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
    () =>
      buildDashboardTimelineSeries({
        salesSeries,
        purchasesSeries: purchSeries,
        expensesSeries: expSeries,
        isAnnualChart,
        t,
      }),
    [salesSeries, purchSeries, expSeries, isAnnualChart, t],
  );

  const timelineMonthName = dashboardMonthName(lang, chartMonthForDaily);

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
    basketAvgCalendar: selectedMonth != null ? monthAverageForDailyAvg?.basketAvg ?? null : null,
    basketAvgPrevMonthCalendar: selectedMonth != null ? prevMonthAverageForDailyAvg?.basketAvg ?? null : null,
    basketAvgDeltaPct: selectedMonth != null ? overviewData.presentation?.basketAvgDeltaPct ?? null : null,
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
    weeklyPanelYearA: weeklyState.yearA,
    setWeeklyPanelYearA: weeklyState.setYearA,
    weeklyPanelMonthA: weeklyState.monthA,
    setWeeklyPanelMonthA: weeklyState.setMonthA,
    weeklyPanelYearB: weeklyState.yearB,
    setWeeklyPanelYearB: weeklyState.setYearB,
    weeklyPanelMonthB: weeklyState.monthB,
    setWeeklyPanelMonthB: weeklyState.setMonthB,
    weeklyYearOptions: weeklyState.yearOptions,
    weeklyMonthOptions: weeklyState.monthOptions,
    weeklySalesWeekRows,
    weeklySalesPanelLoading,
  };
}

export { MONTH_NAMES_AR, MONTH_NAMES_EN, PIE_COLORS };

export type DashboardOverviewModel = ReturnType<typeof useDashboardOverviewModel>;
