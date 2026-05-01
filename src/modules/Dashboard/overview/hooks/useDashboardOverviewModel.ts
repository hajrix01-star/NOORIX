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
  const [weeklySalesCompareMode, setWeeklySalesCompareMode] = useState<'mom' | 'yoy'>('mom');

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

  const baselineDailyBounds = useMemo(() => {
    if (selectedMonth == null) {
      return { start: null as string | null, end: null as string | null, refYear: year, refMonth: 1 };
    }
    if (weeklySalesCompareMode === 'mom') {
      if (selectedMonth >= 2) {
        const m = selectedMonth - 1;
        const ld = lastDayOfMonth(year, m);
        return {
          start: ymd(year, m, 1),
          end: ymd(year, m, ld),
          refYear: year,
          refMonth: m,
        };
      }
      const ldDec = lastDayOfMonth(year - 1, 12);
      return {
        start: ymd(year - 1, 12, 1),
        end: ymd(year - 1, 12, ldDec),
        refYear: year - 1,
        refMonth: 12,
      };
    }
    const ld = lastDayOfMonth(year - 1, selectedMonth);
    return {
      start: ymd(year - 1, selectedMonth, 1),
      end: ymd(year - 1, selectedMonth, ld),
      refYear: year - 1,
      refMonth: selectedMonth,
    };
  }, [year, selectedMonth, weeklySalesCompareMode]);

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

  const { dailySummaries: baselineDailySummaries, isLoading: baselineSalesPackLoading } = useDashboardSalesPack({
    companyId,
    yearStart,
    yearEnd,
    dailyStart: baselineDailyBounds.start,
    dailyEnd: baselineDailyBounds.end,
    monthStart: null,
    monthEnd: null,
    enabled: !!companyId && selectedMonth != null,
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
    if (selectedMonth == null) return null;

    const curBuckets = bucketMonthIntoWeeks(year, selectedMonth, dailySummaries);
    const { refYear, refMonth } = baselineDailyBounds;
    const baseBuckets = bucketMonthIntoWeeks(refYear, refMonth, baselineDailySummaries);

    const baselineLabel =
      lang === 'ar'
        ? `${MONTH_NAMES_AR[refMonth - 1]} ${refYear}`
        : `${MONTH_NAMES_EN[refMonth - 1]} ${refYear}`;

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

    return { rows, baselineLabel };
  }, [
    baselineDailyBounds,
    baselineDailySummaries,
    dailySummaries,
    lang,
    selectedMonth,
    year,
  ]);

  const weeklySalesPanelLoading = selectedMonth != null && (salesPackLoading || baselineSalesPackLoading);

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
    weeklySalesWeekRows,
    weeklySalesPanelLoading,
  };
}

export { MONTH_NAMES_AR, MONTH_NAMES_EN, PIE_COLORS };

export type DashboardOverviewModel = ReturnType<typeof useDashboardOverviewModel>;
