/**
 * تقرير مبسّط قبل الحفظ — شفت صباحي + مسائي + المجموع
 */
import React from 'react';
import { FmtNum } from '../../../ui';
import { fmt } from '../../../utils/format';
import type { SalesShiftValue } from '../constants/salesShift';
import { getSalesShiftLabel } from '../constants/salesShift';
import { buildDayShiftReportFromEntryRows, type EntryShiftRow } from '../utils/salesDayShiftReport';

type ShiftRow = {
  shift: SalesShiftValue;
  total: number;
  customers: number;
};

type Props = {
  rows: ShiftRow[];
  grandTotal: number;
  grandCustomers: number;
  t: (key: string) => string;
};

function shiftEmoji(shift: SalesShiftValue): string {
  if (shift === 'morning') return '🌅';
  if (shift === 'evening') return '🌙';
  return '☀️';
}

/** بناء صفوف التقرير من نماذج الإدخال */
export function buildDualShiftPreviewRows(
  activeShifts: SalesShiftValue[],
  getTotal: (shift: SalesShiftValue) => number,
  getCustomers: (shift: SalesShiftValue) => number,
): ShiftRow[] {
  return activeShifts.map((shift) => ({
    shift,
    total: getTotal(shift),
    customers: getCustomers(shift),
  }));
}

/** تحويل صفوف المعاينة إلى DayShiftReport لنص واتساب */
export function previewRowsToDayShiftReport(rows: ShiftRow[]) {
  return buildDayShiftReportFromEntryRows(rows as EntryShiftRow[]);
}

export function SalesDualShiftEntryReport({ rows, grandTotal, grandCustomers, t }: Props) {
  return (
    <div className="noorix-surface-card flex flex-col gap-0 overflow-hidden p-0">
      <div className="border-b border-noorix-border px-3 py-2">
        <span className="text-[12px] font-bold text-noorix-text">{t('salesEntryDualShiftReport')}</span>
      </div>
      <div className="flex flex-col divide-y divide-noorix-border">
        {rows.map((row) => (
          <div key={row.shift} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <span className="text-[12px] font-semibold text-noorix-muted">
              {shiftEmoji(row.shift)} {getSalesShiftLabel(row.shift, t)}
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <span dir="ltr" className="font-bold text-nx-sales nx-font-numbers">
                <FmtNum n={row.total} /> <span className="nx-sar">SR</span>
              </span>
              <span className="text-noorix-muted">
                {t('customersLabel')}: <span className="font-semibold text-noorix-text nx-font-numbers">{fmt(row.customers, 0)}</span>
              </span>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-noorix-bg-muted/40 px-3 py-3">
          <span className="text-[13px] font-bold text-noorix-text">📌 {t('salesDailyWaGrandTotal')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span dir="ltr" className="text-[14px] font-black text-nx-sales nx-font-numbers">
              <FmtNum n={grandTotal} /> <span className="nx-sar">SR</span>
            </span>
            <span className="text-[12px] text-noorix-muted">
              {t('customersLabel')}: <span className="font-bold text-noorix-text nx-font-numbers">{fmt(grandCustomers, 0)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
