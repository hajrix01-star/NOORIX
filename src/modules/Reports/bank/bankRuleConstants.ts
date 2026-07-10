import type { BankTransactionSide, TranslationFn } from './bankAnalysisTab.types';

export const TRANSACTION_TYPES = [
  { value: 'revenue', labelKey: 'bankRuleTypeRevenue', color: 'rgba(22,163,74,0.2)', colorText: '#15803d', icon: 'REV' },
  { value: 'expense', labelKey: 'bankRuleTypeExpense', color: 'rgba(220,38,38,0.15)', colorText: '#b91c1c', icon: 'EXP' },
  { value: 'transfer', labelKey: 'bankRuleTypeTransfer', color: 'rgba(37,99,235,0.15)', colorText: '#1d4ed8', icon: 'TRF' },
  { value: 'supplier', labelKey: 'bankRuleTypeSupplier', color: 'rgba(234,88,12,0.15)', colorText: '#c2410c', icon: 'SUP' },
  { value: 'government', labelKey: 'bankRuleTypeGovernment', color: 'rgba(126,34,206,0.15)', colorText: '#6b21a8', icon: 'GOV' },
  { value: 'bank_fee', labelKey: 'bankRuleTypeBankFee', color: 'rgba(75,85,99,0.15)', colorText: '#374151', icon: 'BANK' },
  { value: 'cash', labelKey: 'bankRuleTypeCash', color: 'rgba(202,138,4,0.2)', colorText: '#a16207', icon: 'CASH' },
] as const;

export const TRANSACTION_SIDES = [
  { value: 'any', labelKey: 'bankRuleSideAny', icon: '↔' },
  { value: 'debit', labelKey: 'bankRuleSideDebit', icon: 'OUT' },
  { value: 'credit', labelKey: 'bankRuleSideCredit', icon: 'IN' },
] as const;

export type BankRuleTypeValue = typeof TRANSACTION_TYPES[number]['value'];

export function getTransactionTypeInfo(value: string | null | undefined, t: TranslationFn) {
  const row = TRANSACTION_TYPES.find((item) => item.value === value);
  if (!row) return { label: value || '—', color: 'rgba(75,85,99,0.12)', colorText: '#374151', icon: 'GEN' };
  return { ...row, label: t(row.labelKey) };
}

export function getTransactionSideInfo(value: BankTransactionSide | null | undefined, _t: TranslationFn) {
  return TRANSACTION_SIDES.find((side) => side.value === (value || 'any')) || TRANSACTION_SIDES[0];
}
