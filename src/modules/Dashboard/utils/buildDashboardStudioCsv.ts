import type { DashboardOverviewModel } from '../overview/hooks/useDashboardOverviewModel';
import { getCardValue, getPctStringForCard } from '../overview/utils/dashboardOverviewCalculations';

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
