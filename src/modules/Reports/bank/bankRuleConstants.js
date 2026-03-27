/** مطابق RuleConstants.jsx في Base44 (قواعد التصنيف الشجرية) */
export const TRANSACTION_TYPES = [
  { value: 'revenue', labelKey: 'bankRuleTypeRevenue', color: 'rgba(22,163,74,0.2)', colorText: '#15803d', icon: '💰' },
  { value: 'expense', labelKey: 'bankRuleTypeExpense', color: 'rgba(220,38,38,0.15)', colorText: '#b91c1c', icon: '💸' },
  { value: 'transfer', labelKey: 'bankRuleTypeTransfer', color: 'rgba(37,99,235,0.15)', colorText: '#1d4ed8', icon: '🔄' },
  { value: 'supplier', labelKey: 'bankRuleTypeSupplier', color: 'rgba(234,88,12,0.15)', colorText: '#c2410c', icon: '🏭' },
  { value: 'government', labelKey: 'bankRuleTypeGovernment', color: 'rgba(126,34,206,0.15)', colorText: '#6b21a8', icon: '🏛️' },
  { value: 'bank_fee', labelKey: 'bankRuleTypeBankFee', color: 'rgba(75,85,99,0.15)', colorText: '#374151', icon: '🏦' },
  { value: 'cash', labelKey: 'bankRuleTypeCash', color: 'rgba(202,138,4,0.2)', colorText: '#a16207', icon: '💵' },
];

export const TRANSACTION_SIDES = [
  { value: 'any', labelKey: 'bankRuleSideAny', icon: '↔️' },
  { value: 'debit', labelKey: 'bankRuleSideDebit', icon: '📤' },
  { value: 'credit', labelKey: 'bankRuleSideCredit', icon: '📥' },
];

export function getTransactionTypeInfo(value, t) {
  const row = TRANSACTION_TYPES.find((x) => x.value === value);
  if (!row) return { label: value || '—', color: 'rgba(75,85,99,0.12)', colorText: '#374151', icon: '📌' };
  return { ...row, label: t(row.labelKey) };
}

export function getTransactionSideInfo(value, t) {
  return TRANSACTION_SIDES.find((s) => s.value === (value || 'any')) || TRANSACTION_SIDES[0];
}
