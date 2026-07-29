import type {
  ExpenseCategoryRef,
  ExpenseLineKind,
  ExpenseLinePaymentRecord,
  ExpenseLineRecord,
  ExpenseSupplierRef,
} from '../../types/api';
import { localizedDisplayName } from '../../utils/displayName';

export type ExpenseLang = 'ar' | 'en' | string;

export type ExpenseLineFormState = {
  nameAr: string;
  nameEn: string;
  kind: ExpenseLineKind;
  categoryId: string;
  supplierId: string;
  serviceNumber: string;
  notes: string;
  referenceAmount: string;
  allowPaymentAmountOverride: boolean;
  annualTotalAmount: string;
  installmentIntervalMonths: string;
};

export type ExpensePaymentFormState = {
  expenseLineId: string;
  totalAmount: string;
  transactionDate: string;
  primaryVaultId: string;
  supplierInvoiceNumber: string;
  notes: string;
  warrantyFollowUp: boolean;
  coverageMode: 'quarter' | 'month_range';
  expenseCoverageYear: number;
  expenseCoverageQuarter: number;
  expenseCoverageMonthStart: number;
  expenseMonthsCovered: number;
};

export type ExpenseBatchRow = {
  key: string;
  expenseLineId: string;
  supplierInvoiceNumber: string;
  totalInclusive: string;
  notes: string;
  warrantyFollowUp: boolean;
  exemptThisPayment: boolean;
};

export type ExpenseBatchViewRow = ExpenseBatchRow & {
  index: number;
  lineName: string;
  categoryName: string;
  supplierName: string;
  kindLabel: string;
  net: number;
  tax: number;
};

export type ExpenseDraftSummary = {
  totalNet: number;
  totalTax: number;
  total: number;
  count: number;
};

export type ExpensePaymentExportSource = Omit<Partial<ExpenseLinePaymentRecord>, 'id' | 'supplier' | 'expenseLine'> & {
  id?: string | null;
  supplier?: ExpenseSupplierRef | null;
  expenseLine?: {
    id?: string | null;
    nameAr?: string | null;
    nameEn?: string | null;
    kind?: string | null;
  } | null;
};

export const EXPENSE_LINE_KINDS: ExpenseLineKind[] = ['expense', 'fixed_expense'];
export const EXPENSE_INSTALLMENT_INTERVALS = [1, 2, 3, 4, 6, 12];

export function expenseLineDisplayName(line: Pick<ExpenseLineRecord, 'nameAr' | 'nameEn' | 'name'>, lang: ExpenseLang): string {
  return localizedDisplayName(line, lang, '');
}

export function expenseSupplierDisplayName(supplier: ExpenseSupplierRef | null | undefined, lang: ExpenseLang): string {
  return localizedDisplayName(supplier, lang, '-');
}

export function expenseCategoryDisplayName(category: ExpenseCategoryRef | null | undefined, lang: ExpenseLang): string {
  return localizedDisplayName(category, lang, '-');
}

export function expenseLineKindLabel(kind: ExpenseLineKind | string | null | undefined, lang: ExpenseLang): string {
  if (kind === 'fixed_expense') return lang === 'en' ? 'Fixed' : 'ثابت';
  return lang === 'en' ? 'Variable' : 'متغير';
}

export function parseOptionalMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

export function parseRequiredMoney(value: unknown): number {
  return parseOptionalMoney(value) ?? 0;
}

export function parseOptionalInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : null;
}

export function moneyInputFromUnknown(value: unknown): string {
  const number = parseOptionalMoney(value);
  return number == null ? '' : String(number);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
