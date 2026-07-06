import { useMemo, useState } from 'react';
import type { CompanyListItem } from '../../../context/appTypes';
import { getSaudiYearMonth } from '../../../utils/saudiDate';
import type { OwnerOverviewMetric } from '../types';

export function useOwnerDashboardFilters(companies: CompanyListItem[]) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(() => new Set(companies?.map((c) => c.id) || []));
  const [chartGrain, setChartGrain] = useState('monthly');
  const [chartMetric, setChartMetric] = useState<OwnerOverviewMetric>('sales');
  const [comparisonMetric, setComparisonMetric] = useState<OwnerOverviewMetric>('sales');

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
    chartMetric,
    setChartMetric,
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
