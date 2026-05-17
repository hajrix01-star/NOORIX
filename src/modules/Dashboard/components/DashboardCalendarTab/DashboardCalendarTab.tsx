/**
 * DashboardCalendarTab — تقويم حراري للمبيعات
 * أهداف احترافية | تحديد أيام متعددة → إضافة كأيام خاصة | ملاحظة لكل يوم
 */
import React from 'react';
import type { DashboardCalendarTabProps } from './types';
import { useDashboardCalendarTab } from './hooks/useDashboardCalendarTab';
import DashboardCalendarEmptyCompany from './components/DashboardCalendarEmptyCompany';
import DashboardCalendarHeader from './components/DashboardCalendarHeader';
import DashboardCalendarSalesAvgBanner from './components/DashboardCalendarSalesAvgBanner';
import DashboardCalendarTargetsPanel from './components/DashboardCalendarTargetsPanel';
import DashboardCalendarGrid from './components/DashboardCalendarGrid';
import DashboardCalendarSelectionBar from './components/DashboardCalendarSelectionBar';
import DashboardCalendarLegend from './components/DashboardCalendarLegend';
import DashboardCalendarSideDetail from './components/DashboardCalendarSideDetail';
import DashboardCalendarAddSpecialModal from './components/DashboardCalendarAddSpecialModal';

export default function DashboardCalendarTab({ companyId, year, selectedMonth, filter: _filter }: DashboardCalendarTabProps) {
  void _filter;
  const m = useDashboardCalendarTab({ companyId, year, selectedMonth });

  if (!companyId) {
    return <DashboardCalendarEmptyCompany t={m.t} />;
  }

  return (
    <div className="noorix-calendar-layout">
      <div className="noorix-calendar-card noorix-surface-card overflow-hidden p-4 w-full max-w-[760px] min-w-0">
        <DashboardCalendarHeader
          monthLabel={m.monthLabel}
          year={m.year}
          isSelectionMode={m.isSelectionMode}
          onToggleSelectionMode={() => {
            m.setIsSelectionMode((p: boolean) => !p);
            if (m.isSelectionMode) m.setSelectedDates(new Set<string>());
          }}
          onToggleTargetsPanel={() => m.setShowTargetsPanel(!m.showTargetsPanel)}
          onPrintCalendar={m.handlePrintCalendar}
          t={m.t}
        />

        <DashboardCalendarSalesAvgBanner salesDailyAvgOnActiveDays={m.salesDailyAvgOnActiveDays} t={m.t} />

        <DashboardCalendarTargetsPanel
          show={m.showTargetsPanel}
          targetsVersion={m.targetsVersion}
          targets={m.targets}
          editingTarget={m.editingTarget}
          targetInput={m.targetInput}
          onTargetInputChange={m.setTargetInput}
          onSaveOverallTarget={m.handleSaveOverallTarget}
          onCancelEditOverall={() => {
            m.setEditingTarget(false);
            m.setTargetInput('');
          }}
          onStartEditOverall={() => {
            m.setTargetInput(m.targets.overall != null ? String(m.targets.overall) : '');
            m.setEditingTarget(true);
          }}
          onSaveDowTarget={m.handleSaveDowTarget}
          applyToAll={m.applyToAll}
          onToggleApplyToAll={m.setApplyToAll}
          isDefaultTargets={m.isDefaultTargets}
          hasMonthOverride={m.hasMonthOverride}
          onResetMonthTargets={m.handleResetMonthTargets}
          lang={m.lang}
          t={m.t}
        />

        {m.isSelectionMode && (
          <div className="mb-2 text-[10px]" style={{ color: 'var(--noorix-accent-blue)' }}>
            {m.t('dashboardSelectDaysHint')}
          </div>
        )}

        <DashboardCalendarGrid
          year={m.year}
          month={m.month}
          lang={m.lang}
          isLoading={m.isLoading}
          daysInMonth={m.daysInMonth}
          isSelectionMode={m.isSelectionMode}
          selectedDates={m.selectedDates}
          selectedDay={m.selectedDay}
          dayNotes={m.dayNotes}
          maxAmount={m.maxAmount}
          t={m.t}
          onDayClick={m.handleDayClick}
        />

        {m.isSelectionMode && m.selectedDatesSorted.length > 0 && (
          <DashboardCalendarSelectionBar
            selectedCount={m.selectedDatesSorted.length}
            onAddSpecial={() => m.setShowAddSpecialModal(true)}
            onClearSelection={() => m.setSelectedDates(new Set<string>())}
            t={m.t}
          />
        )}

        <DashboardCalendarLegend lang={m.lang} targetsOverall={m.targets.overall} t={m.t} />
      </div>

      <div className="noorix-calendar-side min-w-[260px]">
        <DashboardCalendarSideDetail
          selectedDay={m.selectedDay}
          summaries={m.summaries}
          companyId={companyId}
          companyName={m.companyName}
          dayNotes={m.dayNotes}
          onSaveNote={m.handleSaveDayNote}
          onPrintDayDetails={m.handlePrintDayDetails}
        />
      </div>

      {m.selectedDatesSorted.length > 0 && (
        <DashboardCalendarAddSpecialModal
          open={m.showAddSpecialModal}
          selectedDatesSorted={m.selectedDatesSorted}
          newSpecialName={m.newSpecialName}
          onNewSpecialNameChange={m.setNewSpecialName}
          onClose={() => {
            m.setShowAddSpecialModal(false);
            m.setNewSpecialName('');
          }}
          onSave={m.handleAddSelectedAsSpecial}
          lang={m.lang}
          t={m.t}
        />
      )}
    </div>
  );
}
