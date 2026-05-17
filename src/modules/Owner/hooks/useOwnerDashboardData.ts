import { useMemo } from 'react';
import type { CompanyListItem } from '../../../context/appTypes';
import { useOwnerOverview } from '../../../hooks/useOwnerOverview';
import { SERIES_RECHARTS_COLORS } from '../../../constants/kpiCardTheme';
import {
  buildAggregated,
  buildAggregatedMonthly,
  buildCompanyMonthlyData,
  buildCompanySeries,
  buildGrandMonthlyTotals,
  buildPerformanceData,
} from '../utils/ownerDashboardCalculations';
import type { OwnerDashboardMetric, OwnerDailySalesItem } from '../types';

const COLORS = SERIES_RECHARTS_COLORS;

type UseOwnerDashboardDataArgs = {
  idsToFetch: string[];
  year: number;
  selectedMonthNum: number | null;
  chartGrain: string;
  chartMonthForDaily: number;
  metricFilter: Set<string>;
  comparisonMetric: OwnerDashboardMetric;
  companyList: CompanyListItem[];
  lang: string;
};

export function useOwnerDashboardData({
  idsToFetch,
  year,
  selectedMonthNum,
  chartGrain,
  chartMonthForDaily,
  metricFilter,
  comparisonMetric,
  companyList,
  lang,
}: UseOwnerDashboardDataArgs) {
  // ─── طلب واحد موحّد: P&L + مبيعات يومية لكل الشركات ───────────
  // المبيعات اليومية تُجلب دائماً مع الشهر الحالي (pre-fetch)
  // حتى إذا كان المستخدم في وضع "شهري"، تكون البيانات جاهزة عند التبديل.
  const { data: overviewData, isLoading, isError, error } = useOwnerOverview({
    companyIds: idsToFetch,
    year,
    month: chartMonthForDaily,
    enabled: idsToFetch.length > 0,
  });

  const { reportsByCompany, dailySalesByCompany } = overviewData;

  const aggregated = useMemo(
    () => buildAggregated(reportsByCompany, companyList, lang, selectedMonthNum),
    [reportsByCompany, companyList, lang, selectedMonthNum],
  );

  const aggregatedMonthly = useMemo(
    () => buildAggregatedMonthly(reportsByCompany),
    [reportsByCompany],
  );

  const companyMonthlyData = useMemo(
    () =>
      buildCompanyMonthlyData(idsToFetch, reportsByCompany, companyList, lang, comparisonMetric, COLORS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsToFetch.join(','), reportsByCompany, comparisonMetric, companyList, lang],
  );

  const grandMonthlyTotals = useMemo(
    () => buildGrandMonthlyTotals(companyMonthlyData),
    [companyMonthlyData],
  );

  const grandTotal = useMemo(
    () => grandMonthlyTotals.reduce((a, b) => a + b, 0),
    [grandMonthlyTotals],
  );

  const performanceData = useMemo(
    () =>
      buildPerformanceData({
        chartGrain,
        year,
        chartMonthForDaily,
        idsToFetch,
        reportsByCompany,
        metricFilter,
        lang,
        itemsByCompanyId: dailySalesByCompany as Record<string, OwnerDailySalesItem[]>,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      chartGrain,
      overviewData,      // بديل عن dataStamp — يُعيد الحساب عند وصول البيانات الكاملة
      year,
      chartMonthForDaily,
      idsToFetch.join(','),
      selectedMonthNum,
      reportsByCompany,
      [...metricFilter].join(','),
      lang,
    ],
  );

  const companySeries = useMemo(
    () => buildCompanySeries(idsToFetch, companyList, lang, COLORS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsToFetch.join(','), companyList, lang],
  );

  // واجهة متوافقة مع OwnerPerformanceChart (تتوقع dailySalesQuery.isLoading)
  const dailySalesQuery = useMemo(
    () => ({
      itemsByCompanyId: dailySalesByCompany as Record<string, OwnerDailySalesItem[]>,
      isLoading: false,   // البيانات مدمجة في الطلب الموحّد — لا انتظار إضافي
      isError,
      error,
      enabled: true,
      bounds: null,
      dataStamp: 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dailySalesByCompany, isError, error],
  );

  return {
    reportsByCompany,
    isLoading,
    isError,
    error,
    dailySalesQuery,
    aggregated,
    aggregatedMonthly,
    companyMonthlyData,
    grandMonthlyTotals,
    grandTotal,
    performanceData,
    companySeries,
  };
}

function queryErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return '';
}

export { queryErrorMessage };
