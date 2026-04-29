/**
 * DashboardOverviewTab — حاوية رفيعة: نظرة عامة (KPI + رسوم)
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { ErrorState } from '../../../components/states';
import type { DashboardOverviewTabProps } from './types';
import { useDashboardOverviewModel } from './hooks/useDashboardOverviewModel';
import { DashboardOverviewKpiSkeleton } from './components/DashboardOverviewKpiSkeleton';
import { DashboardOverviewTopCharts } from './components/DashboardOverviewTopCharts';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
import { DashboardOverviewTimelineSection } from './components/DashboardOverviewTimelineSection';
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

  return (
    <div className="flex flex-col gap-5">
      <DashboardOverviewTopCharts
        lang={m.lang}
        supplierFrom={m.supplierFrom}
        supplierTo={m.supplierTo}
        isPeriodLoading={m.isPeriodLoading}
        topSuppliersChartData={m.topSuppliersChartData}
        purchaseCategoriesPieData={m.purchaseCategoriesPieData}
        selectedMonth={m.selectedMonth}
        periodPurchaseTotal={Number(m.periodData?.purchaseCategoryTotal || 0)}
      />

      <DashboardOverviewKpis
        report={m.report}
        selectedMonth={m.selectedMonth}
        cards={m.cards}
        filter={m.filter}
        year={m.year}
        revenueDailyAvgActiveDays={m.revenueDailyAvgActiveDays}
        kpiInsightFooters={m.kpiInsightFooters}
      />

      <DashboardOverviewTimelineSection
        lang={m.lang}
        timelineGrain={m.timelineGrain}
        setTimelineGrain={m.setTimelineGrain}
        timelineMonthName={m.timelineMonthName}
        year={m.year}
        performanceData={m.performanceData as Record<string, string | number>[]}
        perfTotal={m.perfTotal}
        channelData={m.channelData}
        hiddenSeries={m.hiddenSeries}
        toggleSeries={m.toggleSeries}
        SERIES={m.SERIES}
        pieColors={m.pieColors}
        uiDir={m.uiDir}
      />
    </div>
  );
}

export type { DashboardOverviewTabProps } from './types';
