/**
 * محتوى نظرة عامة لوحة التحكم (مخططات + KPI + زمني) — يُستدعى النموذج مرة واحدة في الأب.
 */
import React from 'react';
import { DashboardOverviewTopCharts } from './components/DashboardOverviewTopCharts';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
import { DashboardOverviewWeeklySalesPanel } from './components/DashboardOverviewWeeklySalesPanel';
import { DashboardOverviewYearlyDailyAvgPanel } from './components/DashboardOverviewYearlyDailyAvgPanel';
import { DashboardOverviewTimelineSection } from './components/DashboardOverviewTimelineSection';
import type { DashboardOverviewModel } from './hooks/useDashboardOverviewModel';

export type DashboardOverviewContentProps = {
  m: DashboardOverviewModel;
};

export function DashboardOverviewContent({ m }: DashboardOverviewContentProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 lg:gap-5">
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

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-5">
        <DashboardOverviewWeeklySalesPanel
          weeklyYearOptions={m.weeklyYearOptions}
          weeklyMonthOptions={m.weeklyMonthOptions}
          panelYearA={m.weeklyPanelYearA}
          panelMonthA={m.weeklyPanelMonthA}
          panelYearB={m.weeklyPanelYearB}
          panelMonthB={m.weeklyPanelMonthB}
          onPanelYearAChange={m.setWeeklyPanelYearA}
          onPanelMonthAChange={m.setWeeklyPanelMonthA}
          onPanelYearBChange={m.setWeeklyPanelYearB}
          onPanelMonthBChange={m.setWeeklyPanelMonthB}
          data={m.weeklySalesWeekRows}
          isLoading={m.weeklySalesPanelLoading}
        />

        <DashboardOverviewYearlyDailyAvgPanel
          year={m.year}
          rows={m.yearlyDailyAvgRows}
          selectedMonth={m.selectedMonth}
        />
      </div>

      <DashboardOverviewTimelineSection
        lang={m.lang}
        timelineGrain={m.timelineGrain}
        setTimelineGrain={m.setTimelineGrain}
        timelineMonthName={m.timelineMonthName}
        year={m.year}
        performanceData={m.performanceData}
        perfTotal={m.perfTotal}
        channelData={m.channelData}
        channelPeriodLabel={m.channelPeriodLabel}
        hiddenSeries={m.hiddenSeries}
        toggleSeries={m.toggleSeries}
        SERIES={m.SERIES}
        pieColors={m.pieColors}
        uiDir={m.uiDir}
      />

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
    </div>
  );
}
