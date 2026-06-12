/**
 * تنسيق نص واتساب الموحّد — نفس رموز ملخص المبيعات (إيموجي قياسية)
 */

import { fmt } from './format';

export const SALES_WA = {
  rule: '━━━━━━━━━━━━━━━━━━━━',
  ruleThin: '────────────────────',
  morning: '🌅',
  evening: '🌙',
  fullDay: '☀️',
  grand: '📌',
  channelBullet: '•',
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

/** عنوان الرسالة — السطر الأول نص فقط (بدون خط فاصل؛ واتساب يعرض ━ كسطر فارغ تقريباً) */
export function waReportHeader(title: string, companyName?: string): string {
  const head = (companyName || '').trim()
    ? `${title} — ${companyName!.trim()}`
    : title;
  return head;
}

/** سطر تاريخ — التسمية تحتوي 📅 */
export function waMetaLine(label: string, value: string): string {
  return `${label} ${value}`;
}

export function waShiftSectionTitle(kind: SalesWaShiftKind, shiftLabel: string): string {
  const sym = waShiftSymbol(kind);
  return `${SALES_WA.ruleThin}\n${sym} ${shiftLabel}\n${SALES_WA.ruleThin}`;
}

/** عنوان فرعي — التسمية تحتوي 🏪 */
export function waSubheading(label: string): string {
  return `  ${label}`;
}

/** سطر قناة: • بنك: 996 SR */
export function waChannelRow(vaultLabel: string, amountText: string): string {
  return `  ${SALES_WA.channelBullet} ${vaultLabel}: ${amountText} SR`;
}

/** سطر مالي — التسمية تحتوي الرمز (💰 👥 💵 …) */
export function waMetricLine(label: string, value: string): string {
  return `  ${label} ${value}`;
}

/** إجمالي ÷ عدد العملاء — معدل الطلب / متوسط الفاتورة */
export function salesWaAvgPerCustomer(total: number, customers: number): number {
  const cc = Number(customers) || 0;
  const amount = Number(total) || 0;
  return cc > 0 ? amount / cc : 0;
}

/** سطر متوسط الفاتورة في تقارير واتساب */
export function waAvgSaleMetricLine(avgLabel: string, total: number, customers: number): string {
  return waMetricLine(avgLabel, `${fmt(salesWaAvgPerCustomer(total, customers))} SR`);
}

/** @deprecated استخدم waMetricLine — التسمية تحتوي 👥 */
export function waCustomersLine(label: string, countText: string): string {
  return waMetricLine(label, countText);
}

/** @deprecated استخدم waMetricLine — التسمية تحتوي 💵 */
export function waCashLine(label: string, value: string): string {
  return waMetricLine(label, value);
}

/** نسبة التطبيقات من المبيعات — مثال: 26.7% (400 / 1,500 SR) */
export function waAppShareMetricLine(
  label: string,
  percent: number,
  appAmount: number,
  totalAmount: number,
): string {
  return waMetricLine(label, `${fmt(percent, 1)}% (${fmt(appAmount)} / ${fmt(totalAmount)} SR)`);
}

/** نسبة التطبيقات فقط — مثال: 26.7% (بدون مبالغ) */
export function waAppSharePercentLine(label: string, percent: number): string {
  return waMetricLine(label, `${fmt(percent, 1)}%`);
}
