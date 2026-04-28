/**
 * AnalyticsStudioScreen — حاوية فقط: تخطيط، حالة الفلاتر، تمرير بيانات للمكوّنات.
 * جلب البيانات عبر useAnalyticsStudio؛ لا استدعاء API مباشر هنا.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { ScreenShell, ScreenTitle } from '../../ui';
import { getSaudiDateParts, getSaudiToday } from '../../utils/saudiDate';
import type { AnalyticsStudioFilterState } from '../../utils/analyticsStudioQueryKey';
import { useAnalyticsStudio } from './hooks/useAnalyticsStudio';
import AnalyticsFilterBar from './AnalyticsFilterBar';
import AnalyticsKpiGrid from './AnalyticsKpiGrid';
import AnalyticsChartsGrid from './AnalyticsChartsGrid';
import AnalyticsSmartAlerts from './AnalyticsSmartAlerts';
import AnalyticsDrilldownTable from './AnalyticsDrilldownTable';
import AnalyticsCompanyComparison from './AnalyticsCompanyComparison';
import AnalyticsTopSuppliersTable from './AnalyticsTopSuppliersTable';

function firstDayOfMonthYmd(): string {
  const p = getSaudiDateParts();
  return `${p.year}-${String(p.month).padStart(2, '0')}-01`;
}

export default function AnalyticsStudioScreen() {
  const { t } = useTranslation();
  const { companies, activeCompanyId, userRole, userPermissions } = useApp();

  const multiCompany = companies.length > 1;

  const [filters, setFilters] = useState<AnalyticsStudioFilterState>(() => ({
    startDate: firstDayOfMonthYmd(),
    endDate: getSaudiToday(),
    companyScope: 'all',
    companyId: '',
  }));

  useEffect(() => {
    if (!multiCompany && activeCompanyId) {
      setFilters((f) => ({
        ...f,
        companyScope: 'one',
        companyId: activeCompanyId,
      }));
    }
  }, [multiCompany, activeCompanyId]);

  const query = useAnalyticsStudio(filters, {
    userRole,
    userPermissions,
  });

  const noCompanySelectable = companies.length === 0;
  const needsCompany =
    filters.companyScope === 'one' && !filters.companyId && multiCompany;

  const empty = !!query.data && query.data.companyIdsIncluded.length === 0 && !query.isLoading;

  const dataReady = !!query.data && query.data.companyIdsIncluded.length > 0;

  const topSuppliers = query.data?.mergedPeriodBlock?.topSuppliers ?? [];

  const tableRows = useMemo(() => query.data?.byCompany ?? [], [query.data?.byCompany]);

  return (
    <ScreenShell embedded>
      <ScreenTitle>{t('analyticsStudioTitle')}</ScreenTitle>

      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        companies={companies}
        multiCompany={multiCompany}
      />

      <AnalyticsKpiGrid
        loading={query.isLoading}
        error={(query.error as Error) ?? null}
        empty={empty}
        noCompany={noCompanySelectable}
        pickCompany={needsCompany}
        noPermission={!query.canReadReports}
        data={query.data}
      />

      <AnalyticsChartsGrid
        loading={query.isLoading}
        error={query.isError}
        empty={empty || !dataReady}
        data={query.data}
      />

      <AnalyticsCompanyComparison loading={query.isLoading} rows={tableRows} />

      <AnalyticsSmartAlerts loading={query.isLoading} alerts={query.data?.alerts ?? []} />

      {!needsCompany && (
        <>
          <div className="mt-8 text-[14px] font-bold">{t('analyticsStudioTopSuppliers')}</div>
          <AnalyticsTopSuppliersTable loading={query.isLoading} rows={topSuppliers} />
        </>
      )}

      <AnalyticsDrilldownTable loading={query.isLoading} rows={tableRows} />
    </ScreenShell>
  );
}
