/**
 * تنسيق نص واتساب الموحّد — نفس رموز ملخص المبيعات (إيموجي قياسية)
 */

import { fmt } from './format';

/** عرض سطر واتساب تقريبي (محاذاة وسط بتباعد — ليس CSS) */
export const WA_LINE_WIDTH = 34;

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

/** تقدير عرض العرض لمحاذاة وسط تقريبية (إيموجي أعرض) */
export function estimateWaDisplayWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (
      (cp >= 0x1f300 && cp <= 0x1faff)
      || (cp >= 0x2600 && cp <= 0x27bf)
      || (cp >= 0x2300 && cp <= 0x23ff)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

/**
 * محاذاة وسط تقريبية — واتساب لا يدعم text-align؛ تباعد بمسافات غير قابلة للكسر.
 * النتيجة تختلف قليلاً بين الجوال والويب ومع RTL.
 */
export function waCenterLine(text: string, width = WA_LINE_WIDTH): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const displayW = estimateWaDisplayWidth(trimmed);
  if (displayW >= width) return trimmed;
  const pad = Math.floor((width - displayW) / 2);
  return pad > 0 ? '\u00A0'.repeat(pad) + trimmed : trimmed;
}

/** عنوان الرسالة — السطر الأول نص فقط (بدون خط فاصل؛ واتساب يعرض ━ كسطر فارغ تقريباً) */
export function waReportHeader(title: string, companyName?: string): string {
  const head = (companyName || '').trim()
    ? `${title} — ${companyName!.trim()}`
    : title;
  return waCenterLine(head);
}

/** سطر تاريخ — التسمية تحتوي 📅 */
export function waMetaLine(label: string, value: string): string {
  return `${label} ${value}`;
}

export function waShiftSectionTitle(kind: SalesWaShiftKind, shiftLabel: string): string {
  const sym = waShiftSymbol(kind);
  const title = waCenterLine(`${sym} ${shiftLabel}`.trim());
  return `${SALES_WA.ruleThin}\n${title}\n${SALES_WA.ruleThin}`;
}

/** عنوان فرعي — التسمية تحتوي 🏪 */
export function waSubheading(label: string): string {
  return waCenterLine(label);
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
