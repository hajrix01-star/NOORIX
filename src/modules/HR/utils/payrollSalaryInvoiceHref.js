/**
 * رابط شاشة الفواتير مُصفّى بمسيرة الرواتب (فاتورة الراتب تُخزَّن بـ batchId = معرف المسيرة).
 */
export function payrollSalaryInvoiceListHref(payrollRunId) {
  if (!payrollRunId) return '/invoices';
  const q = new URLSearchParams({ batchId: String(payrollRunId), kind: 'salary' });
  return `/invoices?${q.toString()}`;
}
