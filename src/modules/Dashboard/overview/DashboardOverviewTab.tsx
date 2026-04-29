/**
 * DashboardOverviewTab — حاوية رفيعة: نظرة عامة (KPI + رسوم)
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ErrorState } from '../../../components/states';
import type { DashboardOverviewTabProps } from './types';
import { useDashboardOverviewModel } from './hooks/useDashboardOverviewModel';
import { DashboardOverviewKpiSkeleton } from './components/DashboardOverviewKpiSkeleton';
import { DashboardOverviewContent } from './DashboardOverviewContent';
export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }: DashboardOverviewTabProps) {
  const { t } = useTranslation();
  const m = useDashboardOverviewModel(companyId, year, selectedMonth, filter);

  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  if (m.isLoading || m.salesPackLoading) {
    return <DashboardOverviewKpiSkeleton />;
  }

  if (m.error) {
    return (
      <ErrorState className="m-4">
        {m.error instanceof Error ? m.error.message : String(m.error)}
      </ErrorState>
    );
  }

  return <DashboardOverviewContent m={m} />;
}

export type { DashboardOverviewTabProps } from './types';
