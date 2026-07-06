import React from 'react';
import { toYmd } from '../../../../../utils/saudiDate';
import type { DashboardCalendarDay, DashboardSalesSummary } from '../../../../../types/api/domains/dashboard';
import { toDashboardNumber } from '../../../utils/dashboardNumberModel';
import CalendarDayDetailPanel from '../../CalendarDayDetailPanel';

export interface DashboardCalendarSideDetailProps {
  selectedDay: DashboardCalendarDay | null;
  summaries: DashboardSalesSummary[];
  companyId: string;
  companyName: string;
  dayNotes: Record<string, string>;
  onSaveNote: (dateStr: string, note: string) => void;
  onPrintDayDetails: (
    dateStr: string,
    dayTarget: number | null,
    daySummaries: DashboardSalesSummary[],
    totalAmount: number,
    achieved: boolean,
  ) => void;
}

export default function DashboardCalendarSideDetail({
  selectedDay,
  summaries,
  companyId,
  companyName,
  dayNotes,
  onSaveNote,
  onPrintDayDetails,
}: DashboardCalendarSideDetailProps) {
  if (!selectedDay) return null;
  return (
    <CalendarDayDetailPanel
      dateStr={selectedDay.dateStr}
      dayAmount={selectedDay.amount}
      dayTarget={selectedDay.dayTarget}
      summaries={summaries}
      companyId={companyId}
      companyName={companyName}
      dayNote={dayNotes[selectedDay.dateStr]}
      onSaveNote={(note: string) => onSaveNote(selectedDay.dateStr, note)}
      onPrint={() => {
        const daySummaries = summaries.filter((summary) => toYmd(summary.transactionDate) === selectedDay.dateStr);
        const totalAmount = daySummaries.reduce((sum, summary) => sum + toDashboardNumber(summary.totalAmount), 0);
        const achieved = selectedDay.dayTarget != null && totalAmount >= selectedDay.dayTarget;
        onPrintDayDetails(selectedDay.dateStr, selectedDay.dayTarget, daySummaries, totalAmount, achieved);
      }}
    />
  );
}
