import React from 'react';
import { toYmd } from '../../../../../utils/saudiDate';
import CalendarDayDetailPanel from '../../CalendarDayDetailPanel';

export interface DashboardCalendarSideDetailProps {
  selectedDay: any;
  summaries: any[] | undefined;
  companyId: string;
  companyName: string;
  dayNotes: Record<string, string>;
  onSaveNote: (dateStr: string, note: unknown) => void;
  onPrintDayDetails: (
    dateStr: any,
    dayTarget: any,
    daySummaries: any,
    totalAmount: any,
    achieved: any,
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
      onSaveNote={(note: unknown) => onSaveNote(selectedDay.dateStr, note)}
      onPrint={() => {
        const daySummaries = (summaries || []).filter((s: any) => toYmd(s.transactionDate) === selectedDay.dateStr);
        const totalAmount = daySummaries.reduce((s: number, x: any) => s + Number(x.totalAmount || 0), 0);
        const achieved = selectedDay.dayTarget != null && totalAmount >= selectedDay.dayTarget;
        onPrintDayDetails(selectedDay.dateStr, selectedDay.dayTarget, daySummaries, totalAmount, achieved);
      }}
    />
  );
}
