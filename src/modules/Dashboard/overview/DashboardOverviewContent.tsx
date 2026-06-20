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
    <div className="flex flex-col gap-5">
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

      <DashboardOverviewKpis
        report={m.report}
        selectedMonth={m.selectedMonth}
        cards={m.cards}
        filter={m.filter}
        year={m.year}
        revenueMtdEndDay={m.revenueMtdEndDay}
        revenueMtdTotalSum={m.revenueMtdTotalSum}
        revenuePrevMonthTotalSum={m.revenuePrevMonthTotalSum}
        monthName={m.monthName}
        prevMonthName={m.prevMonthName}
        revenueDailyAvgCalendar={m.revenueDailyAvgCalendar}
        revenueDailyAvgPrevMonthCalendar={m.revenueDailyAvgPrevMonthCalendar}
        customerDailyAvgCalendar={m.customerDailyAvgCalendar}
        customerDailyAvgPrevMonthCalendar={m.customerDailyAvgPrevMonthCalendar}
        salesShiftPeriodTotals={m.salesShiftPeriodTotals}
        kpiInsightFooters={m.kpiInsightFooters}
      />

      <DashboardOverviewYearlyDailyAvgPanel
        year={m.year}
        rows={m.yearlyDailyAvgRows}
        selectedMonth={m.selectedMonth}
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
