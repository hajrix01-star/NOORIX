import { useMemo, useState } from 'react';
import type { CompanyListItem } from '../../../context/appTypes';
import { getSaudiYearMonth } from '../../../utils/saudiDate';
import type { OwnerDashboardMetric } from '../types';

export function useOwnerDashboardFilters(companies: CompanyListItem[]) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(() => new Set(companies?.map((c) => c.id) || []));
  const [chartGrain, setChartGrain] = useState('monthly');
  const [metricFilter, setMetricFilter] = useState(() => new Set<string>(['sales']));
  const [comparisonMetric, setComparisonMetric] = useState<OwnerDashboardMetric>('sales');

  const toggleMetric = (key: string) => {
    setMetricFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const companyList = useMemo(
    () => companies?.filter((c) => !(c as { isArchived?: boolean }).isArchived) || [],
    [companies],
  );

  const allSelected = selectedCompanyIds.size === companyList.length && companyList.length > 0;
  const idsToFetch = [...selectedCompanyIds];
  const selectedMonthNum = selectedMonth ? Number(selectedMonth) : null;

  const saudiYM = getSaudiYearMonth();
  const chartMonthForDaily =
    selectedMonthNum != null ? selectedMonthNum : year === saudiYM.year ? saudiYM.month : 1;

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedCompanyIds(new Set(companyList.map((c) => c.id)));
  const selectNone = () => setSelectedCompanyIds(new Set());

  return {
    currentYear,
    year,
    setYear,
    selectedMonth,
    setSelectedMonth,
    selectedMonthNum,
    selectedCompanyIds,
    setSelectedCompanyIds,
    chartGrain,
    setChartGrain,
    metricFilter,
    setMetricFilter,
    toggleMetric,
    comparisonMetric,
    setComparisonMetric,
    companyList,
    allSelected,
    idsToFetch,
    chartMonthForDaily,
    toggleCompany,
    selectAll,
    selectNone,
  };
}
