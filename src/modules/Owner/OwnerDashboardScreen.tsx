/**
 * OwnerDashboardScreen — لوحة المالك
 * مؤشرات شاملة: المبيعات الشهرية لكل شركة، الأرباح المجمعة، توزيع الأرباح
 */
import React from 'react';
import { EN_MONTHS } from '../Reports/reportHelpers';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTitle } from '../../ui';
import { useApp } from '../../context/AppContext';
import { useOwnerDashboardFilters } from './hooks/useOwnerDashboardFilters';
import { useOwnerDashboardData, queryErrorMessage } from './hooks/useOwnerDashboardData';
import { useOwnerDashboardExports } from './hooks/useOwnerDashboardExports';
import { OwnerFilterBar } from './components/OwnerFilterBar';
import { OwnerKpiCards } from './components/OwnerKpiCards';
import { OwnerPerformanceChart } from './components/OwnerPerformanceChart';
import { OwnerMonthlyComparisonTable } from './components/OwnerMonthlyComparisonTable';
import { MONTH_NAMES_AR } from './utils/ownerDashboardDisplay';
import { ErrorState, LoadingState } from '../../components/states';

export default function OwnerDashboardScreen() {
  const { t, lang } = useTranslation();
  const { companies } = useApp();
  const filters = useOwnerDashboardFilters(companies);
  const {
    dateFilter,
    year,
    selectedMonthNum,
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
  } = filters;

  const data = useOwnerDashboardData({
    idsToFetch,
    year,
    chartMonthForDaily,
    lang,
  });

  const { handleExportExcel, handlePrintPdf, printPreviewModal } = useOwnerDashboardExports(
    data.overview.exportRows,
    lang,
    year,
    selectedMonthNum,
    t,
  );

  const chartMonthName =
    lang === 'ar' ? MONTH_NAMES_AR[chartMonthForDaily - 1] : EN_MONTHS[chartMonthForDaily - 1];
  const chartSubtitle = chartGrain === 'monthly' ? String(year) : `${chartMonthName} — ${year}`;

  if (companyList.length === 0) {
    return (
      <ScreenShell>
        <ScreenTitle>{t('ownerDashboard')}</ScreenTitle>
        <div className="noorix-surface-card text-center text-noorix-muted mt-4 p-8">
          {t('pleaseSelectCompany')}
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      {printPreviewModal}
      <OwnerFilterBar
        dateFilter={dateFilter}
        onExportExcel={handleExportExcel}
        onPrintPdf={handlePrintPdf}
        companyList={companyList}
        allSelected={allSelected}
        selectedCompanyIds={filters.selectedCompanyIds}
        onToggleCompany={toggleCompany}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
      />

      {data.isLoading && (
        <div className="noorix-surface-card p-8">
          <LoadingState className="text-center" />
        </div>
      )}

      {data.isError && (
        <ErrorState className="noorix-surface-card">
          {queryErrorMessage(data.error) || t('loading')}
        </ErrorState>
      )}

      {!data.isLoading && !data.isError && idsToFetch.length > 0 && (
        <>
          <OwnerKpiCards
            kpis={data.overview.kpis}
            year={year}
            selectedMonthNum={selectedMonthNum}
          />
          <OwnerPerformanceChart
            chartGrain={chartGrain}
            setChartGrain={setChartGrain}
            chartMetric={chartMetric}
            setChartMetric={setChartMetric}
            monthlyPerformance={data.overview.monthlyPerformance}
            dailyPerformance={data.overview.dailyPerformance}
            companySeries={data.companySeries}
            chartSubtitle={chartSubtitle}
          />
          <OwnerMonthlyComparisonTable
            year={year}
            comparisonMetric={comparisonMetric}
            setComparisonMetric={setComparisonMetric}
            comparison={data.overview.comparison[comparisonMetric]}
          />
        </>
      )}
    </ScreenShell>
  );
}
