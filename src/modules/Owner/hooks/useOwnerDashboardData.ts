import { useMemo } from 'react';
import type { CompanyListItem } from '../../../context/appTypes';
import { useOwnerReports } from '../../../hooks/useOwnerReports';
import { useOwnerDailySales } from '../../../hooks/useOwnerDailySales';
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
  const { reportsByCompany, isLoading, isError, error } = useOwnerReports({ companyIds: idsToFetch, year });
  const dailySalesQuery = useOwnerDailySales({
    companyIds: idsToFetch,
    year,
    month: chartMonthForDaily,
    enabled: chartGrain === 'daily',
  });

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
        itemsByCompanyId: dailySalesQuery.itemsByCompanyId as Record<string, OwnerDailySalesItem[]>,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      chartGrain,
      dailySalesQuery.dataStamp,
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
