/**
 * محتوى نظرة عامة لوحة التحكم (مخططات + KPI + زمني) — يُستدعى النموذج مرة واحدة في الأب.
 */
import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { DashboardOverviewTopCharts } from './components/DashboardOverviewTopCharts';
import { DashboardOverviewKpis } from './components/DashboardOverviewKpis';
import { DashboardOverviewRevenueMonthBody } from './components/DashboardOverviewRevenueMonthBody';
import { DashboardOverviewWeeklySalesPanel } from './components/DashboardOverviewWeeklySalesPanel';
import { DashboardOverviewYearlyDailyAvgPanel } from './components/DashboardOverviewYearlyDailyAvgPanel';
import { DashboardOverviewTimelineSection } from './components/DashboardOverviewTimelineSection';
import type { DashboardOverviewModel } from './hooks/useDashboardOverviewModel';

export type DashboardOverviewContentProps = {
  m: DashboardOverviewModel;
};

export function DashboardOverviewContent({ m }: DashboardOverviewContentProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 lg:gap-5">
      <DashboardOverviewKpis
        report={m.report}
        selectedMonth={m.selectedMonth}
        cards={m.cards}
        filter={m.filter}
        year={m.year}
        kpiInsightFooters={m.kpiInsightFooters}
      />

      {m.selectedMonth != null ? (
        <DashboardOverviewRevenueMonthBody
          mtdEndDay={m.revenueMtdEndDay}
          currentMonthLabel={m.monthName ?? ''}
          prevMonthLabel={m.prevMonthName}
          currentMonthSalesTotal={m.revenueMtdTotalSum}
          prevMonthSalesTotal={m.revenuePrevMonthTotalSum}
          revenueDailyAvg={m.revenueDailyAvgCalendar}
          revenueDailyAvgPrev={m.revenueDailyAvgPrevMonthCalendar}
          customerDailyAvg={m.customerDailyAvgCalendar}
          customerDailyAvgPrev={m.customerDailyAvgPrevMonthCalendar}
          salesShiftPeriodTotals={m.salesShiftPeriodTotals}
          t={t}
          standalone
        />
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start lg:gap-5">
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
