/**
 * DashboardOverviewTab — حاوية رفيعة: نظرة عامة (KPI + رسوم)
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ErrorState } from '../../../components/states';
import type { DashboardOverviewTabProps } from './types';
import { useDashboardOverviewModel } from './hooks/useDashboardOverviewModel';
import { DashboardOverviewKpiSkeleton } from './components/DashboardOverviewKpiSkeleton';
import { DashboardVaultActivitySection } from './components/DashboardVaultActivitySection';
import { DashboardOperationalOverviewSection } from './components/DashboardOperationalOverviewSection';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
export default function DashboardOverviewTab({ companyId, year, selectedMonth, filter }: DashboardOverviewTabProps) {
  const { t } = useTranslation();
  const m = useDashboardOverviewModel(companyId, year, selectedMonth, filter);

  if (!companyId) {
    return <div className="p-8 text-center text-noorix-muted">{t('pleaseSelectCompany')}</div>;
  }

  if (m.isLoading) {
    return <DashboardOverviewKpiSkeleton />;
  }

  if (m.error) {
    return (
      <ErrorState className="m-4">
        {m.error instanceof Error ? m.error.message : String(m.error)}
      </ErrorState>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <DashboardOverviewKpis
        kpiCardsByKey={m.kpiCardsByKey}
        filter={m.filter}
        year={m.year}
        salesShiftPeriodTotals={m.salesShiftPeriodTotals}
        revenueDailyAvgCalendar={m.revenueDailyAvgCalendar}
        revenueDailyAvgPrevMonthCalendar={m.revenueDailyAvgPrevMonthCalendar}
        customerDailyAvgCalendar={m.customerDailyAvgCalendar}
        customerDailyAvgPrevMonthCalendar={m.customerDailyAvgPrevMonthCalendar}
        basketAvgCalendar={m.basketAvgCalendar}
        basketAvgPrevMonthCalendar={m.basketAvgPrevMonthCalendar}
        basketAvgDeltaPct={m.basketAvgDeltaPct}
        kpiInsightFooters={m.kpiInsightFooters}
      />
      <DashboardVaultActivitySection activity={m.vaultActivity} lang={m.lang} t={m.t} />
      <DashboardOperationalOverviewSection overview={m.operationalOverview} lang={m.lang} t={m.t} />
    </div>
  );
}

export type { DashboardOverviewTabProps } from './types';
