import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ErrorState } from '../../../components/states';
import type { DashboardOverviewTabProps } from './types';
import { useDashboardOverviewModel } from './hooks/useDashboardOverviewModel';
import { DashboardOverviewKpiSkeleton } from './components/DashboardOverviewKpiSkeleton';
import DashboardAppSalesTab from '../components/DashboardAppSalesTab';
import { DashboardAnalyticsContent } from './DashboardAnalyticsContent';

export default function DashboardAnalyticsTab({ companyId, year, selectedMonth, filter }: DashboardOverviewTabProps) {
  const { t } = useTranslation();
  const m = useDashboardOverviewModel(companyId, year, selectedMonth, filter);

  if (!companyId) return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  if (m.isLoading) return <DashboardOverviewKpiSkeleton />;
  if (m.error) {
    return <ErrorState className="m-4">{m.error instanceof Error ? m.error.message : String(m.error)}</ErrorState>;
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 lg:gap-5">
      <DashboardAnalyticsContent m={m} />
      <DashboardAppSalesTab data={m.ledgerAppSales} year={year} isLoading={m.isLoading} />
    </div>
  );
}
