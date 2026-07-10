import { toYmd } from '../../../utils/saudiDate';

/**
 * رابط شاشة الفواتير مُصفّى بمسيرة الرواتب (فاتورة الراتب تُخزَّن بـ batchId = معرف المسيرة).
 * يُضاف from/to لشهر المسيرة حتى لا يبقى فلتر الفواتير على «الشهر الحالي» فيخفي الفاتورة.
 */

/** @param {string|Date|null|undefined} payrollMonth — أول يوم الشهر أو ISO */
export function payrollMonthBoundsForInvoiceLink(payrollMonth: string | Date | null | undefined) {
  if (!payrollMonth) return null;
  const s = toYmd(payrollMonth);
  const [y, m] = s.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) return null;
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(y, m, 0));
  const dd = String(last.getUTCDate()).padStart(2, '0');
  const mm2 = String(last.getUTCMonth() + 1).padStart(2, '0');
  const to = `${last.getUTCFullYear()}-${mm2}-${dd}`;
  return { from, to };
}

/**
 * @param {string} payrollRunId
 * @param {string|Date|null|undefined} [payrollMonth] — شهر المسيرة لضبط نطاق التاريخ في الرابط
 */
export function payrollSalaryInvoiceListHref(payrollRunId: string | number | null | undefined, payrollMonth: string | Date | null | undefined) {
  if (!payrollRunId) return '/invoices';
  const q = new URLSearchParams({ batchId: String(payrollRunId), kind: 'salary' });
  const range = payrollMonthBoundsForInvoiceLink(payrollMonth);
  if (range) {
    q.set('from', range.from);
    q.set('to', range.to);
  }
  return `/invoices?${q.toString()}`;
}
