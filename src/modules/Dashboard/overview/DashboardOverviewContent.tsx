/**
 * محتوى نظرة عامة لوحة التحكم (مخططات + KPI + زمني) — يُستدعى النموذج مرة واحدة في الأب.
 */
import React from 'react';
import { DashboardOverviewTopCharts } from './components/DashboardOverviewTopCharts';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
import { DashboardOverviewWeeklySalesPanel } from './components/DashboardOverviewWeeklySalesPanel';
import { DashboardOverviewTimelineSection } from './components/DashboardOverviewTimelineSection';
import type { DashboardOverviewModel } from './hooks/useDashboardOverviewModel';

export type DashboardOverviewContentProps = {
  m: DashboardOverviewModel;
};

export function DashboardOverviewContent({ m }: DashboardOverviewContentProps) {
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

      <DashboardOverviewWeeklySalesPanel
        selectedMonth={m.selectedMonth}
        compareMode={m.weeklySalesCompareMode}
        onCompareModeChange={m.setWeeklySalesCompareMode}
        data={m.weeklySalesComparison}
        isLoading={m.weeklySalesComparisonLoading}
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
