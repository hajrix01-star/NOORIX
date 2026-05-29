/**
 * تنسيق نص واتساب الموحّد (ملخص المبيعات + نهاية اليوم) — رموز BMP: ☀ ☾ ◆ │ ▸
 */

export const SALES_WA = {
  rule: '━━━━━━━━━━━━━━━━━━━━',
  ruleThin: '────────────────────',
  morning: '☀',
  evening: '☾',
  fullDay: '◐',
  grand: '◆',
  branch: '│',
  bullet: '▸',
} as const;

export type SalesWaShiftKind = 'morning' | 'evening' | 'fullDay' | 'grand';

const SHIFT_SYMBOL: Record<SalesWaShiftKind, string> = {
  morning: SALES_WA.morning,
  evening: SALES_WA.evening,
  fullDay: SALES_WA.fullDay,
  grand: SALES_WA.grand,
};

export function waShiftSymbol(kind: SalesWaShiftKind): string {
  return SHIFT_SYMBOL[kind];
}

export function waReportHeader(title: string, companyName?: string): string {
  const head = (companyName || '').trim()
    ? `${title} — ${companyName!.trim()}`
    : title;
  return `${SALES_WA.rule}\n${head}\n${SALES_WA.rule}`;
}

export function waMetaLine(label: string, value: string): string {
  return `${SALES_WA.bullet} ${label} ${value}`;
}

export function waShiftSectionTitle(kind: SalesWaShiftKind, shiftLabel: string): string {
  const sym = waShiftSymbol(kind);
  return `${SALES_WA.ruleThin}\n${sym} ${shiftLabel}\n${SALES_WA.ruleThin}`;
}

export function waSubheading(label: string): string {
  return `  ${SALES_WA.bullet} ${label}`;
}

export function waChannelRow(vaultLabel: string, amountText: string): string {
  return `  ${SALES_WA.branch} ${vaultLabel} · ${amountText} SR`;
}

export function waMetricLine(label: string, value: string): string {
  return `  ${label} ${value}`;
}
