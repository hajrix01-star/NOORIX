import type {
  DashboardCalendarDay,
  DashboardSalesSummary,
} from '../../../../../types/api/domains/dashboard';
import { fmt } from '../../../../../utils/format';
import { buildPrintHtmlTable, buildPrintTableHtml } from '../../../../../utils/printTableHtml';
import { vaultDisplayName } from '../../../../../utils/vaultDisplay';
import { DOW_LABELS, DOW_LABELS_AR } from '../constants';
import { calendarSalesHeatBgForPrint } from '../utils/calendarAchievementUtils';

type TranslationFn = (key: string, ...args: unknown[]) => string;

type PrintCalendarCell = {
  html: string;
  style: string;
};

export function buildDashboardCalendarDayDetailsPrintBody({
  dayTarget,
  daySummaries,
  totalAmount,
  achieved,
  t,
  lang,
}: {
  dayTarget: number | null;
  daySummaries: DashboardSalesSummary[];
  totalAmount: number;
  achieved: boolean;
  t: TranslationFn;
  lang: string;
}) {
  const printRows = daySummaries.map((summary) => ({
    summaryNumber: summary.summaryNumber || '-',
    channels: (summary.channels ?? [])
      .map((channel) => vaultDisplayName(channel.vault, lang))
      .filter(Boolean)
      .join(' | ') || '-',
    customers: summary.customerCount ?? 0,
  }));

  const targetInfo = `<div style="background:#eff6ff;padding:12px;border-radius:8px;margin:12px 0;font-size:13px">
      <strong>${t('dashboardSalesTarget')}:</strong> ${dayTarget != null ? fmt(dayTarget) : '-'} SR &nbsp;|&nbsp;
      <strong>${t('total')}:</strong> <span style="color:${achieved ? '#16a34a' : 'inherit'}">${fmt(totalAmount)} SR${achieved ? ' OK' : ''}</span>
    </div>`;

  const tableHtml = buildPrintTableHtml({
    columns: [
      { key: 'summaryNumber', header: t('summaryNumber') },
      { key: 'channels', header: t('salesChannels') },
      { key: 'customers', header: t('customers'), align: 'end' },
    ],
    rows: printRows,
    emptyMessage: t('noDataInPeriod'),
    footerRows: [[
      { value: t('total'), colSpan: 2 },
      { value: `${fmt(totalAmount)} SR`, align: 'end' },
    ]],
  });

  return `${targetInfo}${tableHtml}`;
}

export function buildDashboardCalendarMonthPrintBody({
  daysInMonth,
  maxAmount,
  year,
  month,
  lang,
}: {
  daysInMonth: DashboardCalendarDay[];
  maxAmount: number;
  year: number;
  month: number;
  lang: string;
}) {
  const cells: PrintCalendarCell[] = daysInMonth.map((item) => {
    const { day, amount, dayTarget, special } = item;
    const achieved = dayTarget != null && amount >= dayTarget;
    const bg = calendarSalesHeatBgForPrint(amount, dayTarget, maxAmount);
    const specialBorder = special?.color ? `;border-bottom:3px solid ${special.color}` : '';
    return {
      html: `${day}<br><span style="font-weight:700">${fmt(amount, 0)}</span>${achieved ? ' OK' : ''}`,
      style: `padding:6px;text-align:center;border:1px solid #ddd;background:${bg}${specialBorder}`,
    };
  });

  const firstDow = new Date(year, month - 1, 1).getDay();
  const rows: Array<{ cells: Array<{ value?: string; html?: string; style?: string }> }> = [];
  let row: Array<{ value?: string; html?: string; style?: string }> = Array(firstDow).fill(null).map(() => ({ value: '' }));
  cells.forEach((cell, index) => {
    row.push(cell);
    if ((firstDow + index + 1) % 7 === 0) {
      rows.push({ cells: row });
      row = [];
    }
  });
  if (row.length) rows.push({ cells: row });

  const dowHeader = lang === 'ar' ? DOW_LABELS_AR : DOW_LABELS;
  const dowOrder = [0, 1, 2, 3, 4, 5, 6] as const;
  return buildPrintHtmlTable({
    tableClassName: 'dashboard-calendar-print-table',
    wrapperClassName: null,
    headerRows: [{
      cells: dowOrder.map((day) => ({ value: dowHeader[day] })),
    }],
    bodyRows: rows,
    emptyColSpan: 7,
  });
}
