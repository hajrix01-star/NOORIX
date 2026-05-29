/**
 * تنسيق نص واتساب الموحّد (ملخص المبيعات + نهاية اليوم) — رموز BMP
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
  /** نقد / خزينة نقدية */
  cash: '¤',
  /** بنك */
  bank: '▣',
  /** تطبيق / رقمي */
  app: '◎',
  /** عملاء */
  people: '※',
} as const;

export type SalesWaShiftKind = 'morning' | 'evening' | 'fullDay' | 'grand';
export type VaultTypeHint = 'cash' | 'bank' | 'app' | string | null | undefined;

const SHIFT_SYMBOL: Record<SalesWaShiftKind, string> = {
  morning: SALES_WA.morning,
  evening: SALES_WA.evening,
  fullDay: SALES_WA.fullDay,
  grand: SALES_WA.grand,
};

export function waShiftSymbol(kind: SalesWaShiftKind): string {
  return SHIFT_SYMBOL[kind];
}

/** رمز القناة حسب نوع الخزينة أو اسمها */
export function waVaultTypeIcon(vaultType?: VaultTypeHint, nameHint?: string): string {
  const t = String(vaultType || '').toLowerCase();
  if (t === 'cash') return SALES_WA.cash;
  if (t === 'bank') return SALES_WA.bank;
  if (t === 'app') return SALES_WA.app;

  const n = `${nameHint || ''}`.toLowerCase();
  if (/بنك|bank/.test(n)) return SALES_WA.bank;
  if (/نقد|cash|صندوق|كاش/.test(n)) return SALES_WA.cash;
  if (/تطبيق|app|رقم|digital/.test(n)) return SALES_WA.app;

  return SALES_WA.branch;
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

export function waChannelRow(
  vaultLabel: string,
  amountText: string,
  vaultType?: VaultTypeHint,
): string {
  const icon = waVaultTypeIcon(vaultType, vaultLabel);
  return `  ${icon} ${vaultLabel} · ${amountText} SR`;
}

export function waMetricLine(label: string, value: string): string {
  return `  ${label} ${value}`;
}

/** عدد العملاء */
export function waCustomersLine(label: string, countText: string): string {
  return `  ${SALES_WA.people} ${label} ${countText}`;
}

/** سطر كاش (دخل / خرج / متوفر) */
export function waCashLine(label: string, value: string): string {
  return `  ${SALES_WA.cash} ${label} ${value}`;
}
