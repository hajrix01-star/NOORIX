/**
 * منطق خاضعية ضريبة القيمة المضافة لمصروف (ثابت/متغير):
 * — الحساب المعفى (taxExempt) يمنع الضريبة دائماً.
 * — وإلا: يُفترض الخضوع إذا كان المورد مسجّلاً في الضريبة (isTaxRegistered !== false).
 * — المستخدم يمكنه «إعفاء هذه الدفعة» استثناءً عندما كان الخضوع ممكناً افتراضياً.
 */

/** @param {{ isTaxRegistered?: boolean } | null | undefined} supplier */
export function supplierAppliesVat(supplier) {
  if (!supplier) return true;
  return supplier.isTaxRegistered !== false;
}

/**
 * @param {{ category?: { account?: { taxExempt?: boolean } } | null }; supplier?: { isTaxRegistered?: boolean } | null } | null | undefined} line
 * @param {boolean} exemptThisPayment — إعفاء استثنائي لهذه الدفعة فقط
 */
export function isExpensePaymentTaxable(line, exemptThisPayment) {
  if (!line) return false;
  if (line.category?.account?.taxExempt) return false;
  if (!supplierAppliesVat(line.supplier)) return false;
  if (exemptThisPayment) return false;
  return true;
}

/** هل يُعرض خيار «إعفاء هذه الدفعة» (لا معنى له إن كان المورد غير مسجّل أو الحساب معفى). */
export function canExemptThisExpensePayment(line) {
  if (!line) return false;
  if (line.category?.account?.taxExempt) return false;
  return supplierAppliesVat(line.supplier);
}
