import type { ExpenseLineRecord, ExpenseSupplierRef } from '../../../types/api';

export function supplierAppliesVat(supplier: ExpenseSupplierRef | null | undefined): boolean {
  if (!supplier) return true;
  return supplier.isTaxRegistered !== false;
}

export function isExpensePaymentTaxable(
  line: Pick<ExpenseLineRecord, 'category' | 'supplier'> | null | undefined,
  exemptThisPayment: boolean,
): boolean {
  if (!line) return false;
  if (line.category?.account?.taxExempt) return false;
  if (!supplierAppliesVat(line.supplier)) return false;
  if (exemptThisPayment) return false;
  return true;
}

export function canExemptThisExpensePayment(
  line: Pick<ExpenseLineRecord, 'category' | 'supplier'> | null | undefined,
): boolean {
  if (!line) return false;
  if (line.category?.account?.taxExempt) return false;
  return supplierAppliesVat(line.supplier);
}
