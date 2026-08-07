import React from 'react';
import { DashboardOverviewTopCharts } from './components/DashboardOverviewTopCharts';
import { DashboardOverviewWeeklySalesPanel } from './components/DashboardOverviewWeeklySalesPanel';
import { DashboardOverviewYearlyDailyAvgPanel } from './components/DashboardOverviewYearlyDailyAvgPanel';
import { DashboardOverviewTimelineSection } from './components/DashboardOverviewTimelineSection';
import type { DashboardOverviewModel } from './hooks/useDashboardOverviewModel';

type Props = {
  m: DashboardOverviewModel;
};

export function DashboardAnalyticsContent({ m }: Props) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 lg:gap-5">
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
        purchaseCategoriesPieData={[]}
        selectedMonth={m.selectedMonth}
        periodPurchaseTotal={0}
        showPurchaseCategories={false}
      />
    </div>
  );
}
