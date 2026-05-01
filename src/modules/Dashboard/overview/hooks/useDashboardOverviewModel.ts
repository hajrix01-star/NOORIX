import { useMemo, useState, useCallback, useEffect } from 'react';
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
import { lastDayOfMonth, prevCalendarMonth, ymd } from '../utils/dashboardOverviewDateUtils';
import {
  buildChannelPieRows,
  buildPerformanceRows,
  buildPurchaseCategoriesData,
  buildTopSuppliersChartData,
  computeRevenueDailyAvgActiveDays,
  mergePurchaseCategoriesOthers,
  performanceTotalForSalesKey,
} from '../utils/dashboardOverviewBuilders';
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
  const { data: report, isLoading, error } = useReportsGeneralProfitLoss({ companyId, year });

  const [timelineGrain, setTimelineGrain] = useState(() => (selectedMonth != null ? 'daily' : 'monthly'));

  const saInit = getSaudiYearMonth();
  const initPrev = prevCalendarMonth(saInit.year, saInit.month);
  const [weeklyPanelYearA, setWeeklyPanelYearA] = useState(saInit.year);
  const [weeklyPanelMonthA, setWeeklyPanelMonthA] = useState(saInit.month);
  const [weeklyPanelYearB, setWeeklyPanelYearB] = useState(initPrev.year);
  const [weeklyPanelMonthB, setWeeklyPanelMonthB] = useState(initPrev.month);

  /** عند اختيار شهر في لوحة التحكم: يُحدَّث العمود أ=ذلك الشهر والعمود ب=الشهر التقويمي السابق. */
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
  /** عند اختيار شهر: نحمّل دائماً الملخصات اليومية لذلك الشهر (أسابيع معزولة). */
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

  const {
    dailySummaries,
    yearSummaries,
    monthSummaries: monthSalesForDailyAvg,
    isLoading: salesPackLoading,
  } = useDashboardSalesPack({
    companyId,
    yearStart,
    yearEnd,
    dailyStart: dailyStartEffective,
    dailyEnd: dailyEndEffective,
    monthStart: monthSalesAvgBounds.start,
    monthEnd: monthSalesAvgBounds.end,
    enabled: !!companyId,
  });

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
    dailyStart: dailyStartEffective,
    dailyEnd: dailyEndEffective,
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
