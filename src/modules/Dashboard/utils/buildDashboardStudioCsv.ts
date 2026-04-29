import type { DashboardOverviewModel } from '../overview/hooks/useDashboardOverviewModel';
import { getCardValue, getPctStringForCard } from '../overview/utils/dashboardOverviewCalculations';
import { PERIOD_INVOICE_KIND_ORDER } from './periodInvoiceKindLabels';

function csvCell(v: string) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type DashboardStudioCsvHeaders = {
  scopeLabel: string;
  metric: string;
  value: string;
  pctOfSales: string;
};

export function buildDashboardStudioKpiCsv(m: DashboardOverviewModel, h: DashboardStudioCsvHeaders): string {
  const lines: string[] = [];
  lines.push([csvCell(h.scopeLabel), csvCell(m.filter?.label || String(m.year)), ''].join(','));
  lines.push([csvCell(h.metric), csvCell(h.value), csvCell(h.pctOfSales)].join(','));
  for (const card of m.cards) {
    const val = getCardValue(m.report, card.key, m.selectedMonth);
    const pct = getPctStringForCard(m.report, card.key, m.selectedMonth);
    lines.push([csvCell(card.label), csvCell(val), pct != null ? csvCell(`${pct}%`) : ''].join(','));
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

/** صفوف إضافية: أعداد/مبالغ حسب نوع الفاتورة من تحليل الفترة */
export function buildDashboardStudioPeriodCsvAppend(
  m: DashboardOverviewModel,
  labels: { section: string; kind: string; amount: string; count: string },
  kindTitle: (kind: string) => string,
): string {
  const pd = m.periodData as { totalsByKind?: Record<string, { totalAmount?: string; invoiceCount?: number }> } | null | undefined;
  if (!pd?.totalsByKind) return '';
  const lines: string[] = [];
  lines.push('');
  lines.push([csvCell(labels.section), '', ''].join(','));
  lines.push([csvCell(labels.kind), csvCell(labels.amount), csvCell(labels.count)].join(','));
  for (const k of PERIOD_INVOICE_KIND_ORDER) {
    const row = pd.totalsByKind[k];
    if (!row || (row.invoiceCount ?? 0) <= 0) continue;
    lines.push([csvCell(kindTitle(k)), csvCell(String(row.totalAmount ?? '0')), csvCell(String(row.invoiceCount ?? 0))].join(','));
  }
  return lines.join('\r\n');
}
