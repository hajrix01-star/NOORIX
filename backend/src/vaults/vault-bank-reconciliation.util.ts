type VaultBankClassificationInput = {
  type?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  paymentMethod?: string | null;
};

/**
 * Used only when a vault is first created or legacy data is migrated. The stored
 * boolean is intentionally immutable afterwards so historical reconciliation does
 * not change when display names, payment methods or operational type are edited.
 */
export function inferBankReconciliationEnabled(vault: VaultBankClassificationInput): boolean {
  const type = String(vault.type || '').toLowerCase();
  const names = `${vault.nameAr || ''} ${vault.nameEn || ''}`.toLowerCase();
  const paymentMethod = String(vault.paymentMethod || '').toLowerCase();
  return type === 'bank'
    || type === 'app'
    || names.includes('بنك')
    || names.includes('bank')
    || names.includes('مدى')
    || names.includes('mada')
    || names.includes('شبكة')
    || paymentMethod.includes('بنك')
    || paymentMethod.includes('bank')
    || paymentMethod.includes('مدى')
    || paymentMethod.includes('mada');
}
