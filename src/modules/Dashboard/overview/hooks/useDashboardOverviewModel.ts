import { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from '../../../../i18n/useTranslation';
import { useDashboardOverview, type DashboardSummaryLike } from '../../../../hooks/useDashboardOverview';
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
  buildYearMonthlyDailyAvgRows,
  computeRevenueDailyAvgActiveDays,
  computeCustomerDailyAvgActiveDays,
  computeRevenueDailyAvgCalendarMtd,
  computeCustomerDailyAvgCalendarMtd,
  revenueMtdEndDay as getRevenueMtdEndDay,
  mergePurchaseCategoriesOthers,
  performanceTotalForSalesKey,
  yearMonthlyDailyAvgCapMonth,
} from '../utils/dashboardOverviewBuilders';
import { computeSalesShiftPeriodTotals } from '../utils/dashboardSalesShiftTotals';
import { bucketMonthIntoWeeks, pctChangeVsBaseline } from '../utils/dashboardWeeklySales';
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

  const monthSalesAvgBounds = useMemo(() => {
    if (selectedMonth == null) return { start: null, end: null };
    const ld = lastDayOfMonth(year, selectedMonth);
    return { start: ymd(year, selectedMonth, 1), end: ymd(year, selectedMonth, ld) };
  }, [year, selectedMonth]);

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

  const { from: supplierFrom, to: supplierTo } = useMemo(
    () => monthDateBounds(year, selectedMonth ?? null),
    [year, selectedMonth],
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
    dailyStart: dailyStartEffective,
    dailyEnd: dailyEndEffective,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    selectedMonth,
    includeCancelledSales: modelOptions?.includeCancelledSales === true,
    enabled: !!companyId,
  });

  const report = overviewData.report;
  const dailySummaries = overviewData.salesPack.dailySummaries;
  const yearSummaries = overviewData.salesPack.yearSummaries;
  const monthSalesForDailyAvg = overviewData.salesPack.monthSummaries;
  const periodData = overviewData.periodData;

  const kpiInsightFooters = useMemo(
    () =>
      buildKpiInsightFooterMap(
        overviewData.insights ?? undefined,
        isError,
        t,
        lang === 'ar',
        report,
        selectedMonth,
      ),
    [overviewData.insights, isError, t, lang, report, selectedMonth],
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

  const { dailySummaries: weeklyDailySummariesA, isLoading: weeklyPackALoading } = useDashboardSalesPack({
    companyId,
    yearStart: weeklyPackYearSpanA.yearStart,
    yearEnd: weeklyPackYearSpanA.yearEnd,
    dailyStart: weeklyBoundsA.start,
    dailyEnd: weeklyBoundsA.end,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId,
  });

  const { dailySummaries: weeklyDailySummariesB, isLoading: weeklyPackBLoading } = useDashboardSalesPack({
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

  const { monthSummaries: prevMonthSalesForDailyAvg } = useDashboardSalesPack({
    companyId,
    yearStart: prevMonthPackYearSpan?.yearStart ?? `${year}-01-01`,
    yearEnd: prevMonthPackYearSpan?.yearEnd ?? `${year}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart: prevMonthSalesAvgBounds.start,
    monthEnd: prevMonthSalesAvgBounds.end,
    enabled: !!companyId && selectedMonth != null && !!prevMonthSalesAvgBounds.start,
  });

  const saudiNow = getSaudiNow();

  const revenueMtdEndDay = useMemo(() => {
    if (selectedMonth == null) return 0;
    return getRevenueMtdEndDay(year, selectedMonth, saudiNow.year, saudiNow.month, saudiNow.day);
  }, [year, selectedMonth, saudiNow.year, saudiNow.month, saudiNow.day]);

  const revenueMtdCalendar = useMemo(() => {
    if (selectedMonth == null || revenueMtdEndDay <= 0) return null;
    return computeRevenueDailyAvgCalendarMtd(
      monthSalesForDailyAvg,
      year,
      selectedMonth,
      revenueMtdEndDay,
    );
  }, [monthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay]);

  const revenueMtdPrevCalendar = useMemo(() => {
    if (selectedMonth == null || revenueMtdEndDay <= 0) return null;
    const prev = prevCalendarMonth(year, selectedMonth);
    return computeRevenueDailyAvgCalendarMtd(
      prevMonthSalesForDailyAvg,
      prev.year,
      prev.month,
      revenueMtdEndDay,
    );
  }, [prevMonthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay]);

  const customerMtdCalendar = useMemo(() => {
    if (selectedMonth == null || revenueMtdEndDay <= 0) return null;
    return computeCustomerDailyAvgCalendarMtd(
      monthSalesForDailyAvg,
      year,
      selectedMonth,
      revenueMtdEndDay,
    );
  }, [monthSalesForDailyAvg, year, selectedMonth, revenueMtdEndDay]);

  const revenueDailyAvgActiveDays = useMemo(
    () => computeRevenueDailyAvgActiveDays(monthSalesForDailyAvg),
    [monthSalesForDailyAvg],
  );

  const revenueDailyAvgPrevMonthActiveDays = useMemo(
    () => computeRevenueDailyAvgActiveDays(prevMonthSalesForDailyAvg),
    [prevMonthSalesForDailyAvg],
  );

  const customerDailyAvgActiveDays = useMemo(
    () => computeCustomerDailyAvgActiveDays(monthSalesForDailyAvg),
    [monthSalesForDailyAvg],
  );

  const customerDailyAvgPrevMonthActiveDays = useMemo(
    () => computeCustomerDailyAvgActiveDays(prevMonthSalesForDailyAvg),
    [prevMonthSalesForDailyAvg],
  );

  const salesShiftPeriodTotals = useMemo(() => {
    const src = selectedMonth != null ? monthSalesForDailyAvg : yearSummaries;
    return computeSalesShiftPeriodTotals(src);
  }, [selectedMonth, monthSalesForDailyAvg, yearSummaries]);

  const yearlyDailyAvgRows = useMemo(() => {
    const capMonth = yearMonthlyDailyAvgCapMonth(year, saudiYM.year, saudiYM.month);
    const monthNames = lang === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN;
    return buildYearMonthlyDailyAvgRows({
      year,
      yearSummaries,
      monthNames,
      capMonth,
      currentYear: saudiYM.year,
      currentMonth: saudiYM.month,
    });
  }, [year, yearSummaries, lang, saudiYM.year, saudiYM.month]);

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

  const weeklySalesWeekRows = useMemo(() => {
    const curBuckets = bucketMonthIntoWeeks(
      weeklyPanelYearA,
      weeklyPanelMonthA,
      weeklyDailySummariesA,
    );
    const baseBuckets = bucketMonthIntoWeeks(
      weeklyPanelYearB,
      weeklyPanelMonthB,
      weeklyDailySummariesB,
    );

    const maxW = Math.max(curBuckets.length, baseBuckets.length);
    const rows = [];
    for (let i = 0; i < maxW; i++) {
      const c = curBuckets[i];
      const b = baseBuckets[i];
      const avgC = c?.avgDailyInWeek ?? 0;
      const avgB = b?.avgDailyInWeek ?? 0;
      rows.push({
        weekIndex: i + 1,
        dayStart: c?.dayStart ?? b?.dayStart ?? 0,
        dayEnd: c?.dayEnd ?? b?.dayEnd ?? 0,
        avgDailyCurrent: avgC,
        avgDailyBaseline: avgB,
        deltaPct: pctChangeVsBaseline(avgC, avgB),
      });
    }

    return { rows };
  }, [
    weeklyDailySummariesA,
    weeklyDailySummariesB,
    weeklyPanelMonthA,
    weeklyPanelMonthB,
    weeklyPanelYearA,
    weeklyPanelYearB,
  ]);

  const weeklySalesPanelLoading = weeklyPackALoading || weeklyPackBLoading;

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
    isPeriodLoading: false,
    periodData,
    cards,
    performanceData,
    channelData,
    perfTotal,
    topSuppliersChartData,
    purchaseCategoriesPieData,
    revenueMtdEndDay,
    revenueMtdCalendar,
    revenueMtdPrevCalendar,
    customerMtdCalendar,
    revenueDailyAvgActiveDays,
    revenueDailyAvgPrevMonthActiveDays,
    customerDailyAvgActiveDays,
    customerDailyAvgPrevMonthActiveDays,
    monthName,
    salesShiftPeriodTotals,
    yearlyDailyAvgRows,
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
