import type {
  ExpenseCategoryRef,
  ExpenseLineCreatePayload,
  ExpenseLineRecord,
  ExpenseLineUpdatePayload,
  ExpensePaymentCreatePayload,
} from '../../types/api';
import { getSaudiToday } from '../../utils/saudiDate';
import {
  canExemptThisExpensePayment,
  isExpenseSupplierInvoiceNumberRequired,
} from './utils/expenseTax';
import {
  EXPENSE_INSTALLMENT_INTERVALS,
  EXPENSE_LINE_KINDS,
  type ExpenseLineFormState,
  type ExpensePaymentFormState,
  expenseLineDisplayName,
  moneyInputFromUnknown,
  parseOptionalInteger,
  parseOptionalMoney,
  parseRequiredMoney,
  roundMoney,
} from './expenseSharedModels';

export function emptyExpenseLineForm(): ExpenseLineFormState {
  return {
    nameAr: '',
    nameEn: '',
    kind: 'expense',
    categoryId: '',
    supplierId: '',
    serviceNumber: '',
    notes: '',
    referenceAmount: '',
    allowPaymentAmountOverride: true,
    annualTotalAmount: '',
    installmentIntervalMonths: '',
  };
}

export function initExpenseLineForm(editing: ExpenseLineRecord | null): ExpenseLineFormState {
  if (!editing) return emptyExpenseLineForm();
  return {
    nameAr: editing.nameAr || '',
    nameEn: editing.nameEn || '',
    kind: editing.kind || 'expense',
    categoryId: editing.categoryId || '',
    supplierId: editing.supplierId || '',
    serviceNumber: editing.serviceNumber || '',
    notes: editing.notes || '',
    referenceAmount: moneyInputFromUnknown(editing.referenceAmount),
    allowPaymentAmountOverride: editing.allowPaymentAmountOverride !== false,
    annualTotalAmount: moneyInputFromUnknown(editing.annualTotalAmount),
    installmentIntervalMonths: editing.installmentIntervalMonths != null ? String(editing.installmentIntervalMonths) : '',
  };
}

export function emptyExpensePaymentForm(defaultYear = Number(getSaudiToday().slice(0, 4))): ExpensePaymentFormState {
  return {
    expenseLineId: '',
    totalAmount: '',
    transactionDate: getSaudiToday(),
    primaryVaultId: '',
    supplierInvoiceNumber: '',
    notes: '',
    warrantyFollowUp: false,
    coverageMode: 'quarter',
    expenseCoverageYear: defaultYear,
    expenseCoverageQuarter: 1,
    expenseCoverageMonthStart: 1,
    expenseMonthsCovered: 3,
  };
}

export function isExpenseCategoryRef(category: {
  id?: unknown;
  type?: unknown;
}): category is ExpenseCategoryRef {
  return typeof category.id === 'string';
}

export function buildExpenseLinePayload(
  form: ExpenseLineFormState,
  companyId: string,
  editing: null,
): ExpenseLineCreatePayload;
export function buildExpenseLinePayload(
  form: ExpenseLineFormState,
  companyId: string,
  editing: ExpenseLineRecord,
): ExpenseLineUpdatePayload;
export function buildExpenseLinePayload(
  form: ExpenseLineFormState,
  companyId: string,
  editing: ExpenseLineRecord | null,
): ExpenseLineCreatePayload | ExpenseLineUpdatePayload {
  const isFixed = form.kind === 'fixed_expense';
  const referenceAmount = parseOptionalMoney(form.referenceAmount);
  const annualTotalAmount = parseOptionalMoney(form.annualTotalAmount);
  const installmentIntervalMonths = parseOptionalInteger(form.installmentIntervalMonths);
  const payload = {
    ...(editing ? {} : { companyId }),
    nameAr: form.nameAr.trim(),
    ...(form.nameEn.trim() ? { nameEn: form.nameEn.trim() } : {}),
    kind: form.kind,
    categoryId: form.categoryId,
    supplierId: form.supplierId,
    ...(form.serviceNumber.trim() ? { serviceNumber: form.serviceNumber.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    ...(isFixed && referenceAmount != null ? { referenceAmount } : {}),
    allowPaymentAmountOverride: isFixed ? form.allowPaymentAmountOverride : true,
    ...(isFixed && annualTotalAmount != null && annualTotalAmount > 0 ? { annualTotalAmount } : {}),
    ...(isFixed && installmentIntervalMonths != null ? { installmentIntervalMonths } : {}),
  };
  return payload;
}

export function validateExpenseLineForm(form: ExpenseLineFormState): string | null {
  if (!form.nameAr.trim()) return 'expenseLineNameRequired';
  if (!form.categoryId) return 'expenseLineCategoryRequired';
  if (!form.supplierId) return 'expenseLineSupplierRequired';
  if (!EXPENSE_LINE_KINDS.includes(form.kind)) return 'expenseLineKindInvalid';
  if (form.kind !== 'fixed_expense') return null;

  const referenceAmount = parseOptionalMoney(form.referenceAmount);
  if (form.referenceAmount.trim() && (referenceAmount == null || referenceAmount < 0)) return 'validationInvalidAmount';

  const annualTotalAmount = parseOptionalMoney(form.annualTotalAmount);
  const interval = parseOptionalInteger(form.installmentIntervalMonths);
  if (annualTotalAmount != null && annualTotalAmount > 0 && (interval == null || !EXPENSE_INSTALLMENT_INTERVALS.includes(interval))) {
    return 'expenseInstallmentIntervalInvalid';
  }
  if (interval != null && !EXPENSE_INSTALLMENT_INTERVALS.includes(interval)) return 'expenseInstallmentIntervalInvalid';
  return null;
}

export function suggestedExpenseLinePaymentAmount(form: ExpenseLineFormState): number | null {
  const annual = parseOptionalMoney(form.annualTotalAmount);
  const interval = parseOptionalInteger(form.installmentIntervalMonths);
  if (annual == null || annual <= 0 || interval == null || !EXPENSE_INSTALLMENT_INTERVALS.includes(interval)) return null;
  const periods = 12 / interval;
  return Math.round((annual / periods) * 100) / 100;
}

export function syncExpensePaymentFormFromLine(
  form: ExpensePaymentFormState,
  line: ExpenseLineRecord | undefined,
): ExpensePaymentFormState {
  if (!line) return form;
  const yearFromDate = Number(form.transactionDate.slice(0, 4)) || Number(getSaudiToday().slice(0, 4));
  return {
    ...form,
    totalAmount: line.referenceAmount != null ? String(line.referenceAmount) : form.totalAmount,
    expenseCoverageYear: line.kind === 'fixed_expense' ? yearFromDate : form.expenseCoverageYear,
    expenseMonthsCovered: line.kind === 'fixed_expense'
      ? line.installmentIntervalMonths ?? form.expenseMonthsCovered
      : form.expenseMonthsCovered,
  };
}

export function isExpensePaymentAmountLocked(line: ExpenseLineRecord | undefined): boolean {
  return Boolean(line && line.referenceAmount != null && line.allowPaymentAmountOverride === false);
}

export function buildExpensePaymentPayload(params: {
  companyId: string;
  form: ExpensePaymentFormState;
  selectedLine: ExpenseLineRecord;
  isTaxable: boolean;
  secondVault?: { enabled: boolean; vaultId: string; amount: string };
}): ExpensePaymentCreatePayload {
  const total = parseRequiredMoney(params.form.totalAmount);
  const base: ExpensePaymentCreatePayload = {
    companyId: params.companyId,
    expenseLineId: params.form.expenseLineId,
    categoryId: params.selectedLine.categoryId,
    supplierId: params.selectedLine.supplierId,
    supplierInvoiceNumber: params.form.supplierInvoiceNumber.trim(),
    kind: params.selectedLine.kind,
    totalAmount: total,
    isTaxable: params.isTaxable,
    transactionDate: params.form.transactionDate,
    ...(params.form.notes.trim() ? { notes: params.form.notes.trim() } : {}),
    ...(params.form.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
  };

  if (params.selectedLine.kind === 'fixed_expense') {
    base.expenseCoverageYear = Number(params.form.expenseCoverageYear);
    if (params.form.coverageMode === 'quarter') {
      base.expenseCoverageQuarter = Number(params.form.expenseCoverageQuarter);
    } else {
      base.expenseCoverageMonthStart = Number(params.form.expenseCoverageMonthStart);
      base.expenseMonthsCovered = Number(params.form.expenseMonthsCovered);
    }
  }

  if (params.secondVault?.enabled) {
    const secondAmount = parseRequiredMoney(params.secondVault.amount);
    base.vaultSplits = [
      { vaultId: params.form.primaryVaultId.trim(), amount: roundMoney(total - secondAmount) },
      { vaultId: params.secondVault.vaultId.trim(), amount: secondAmount },
    ];
  } else {
    base.vaultId = params.form.primaryVaultId.trim();
  }
  return base;
}

export function validateExpensePaymentForm(params: {
  form: ExpensePaymentFormState;
  selectedLine: ExpenseLineRecord | undefined;
  isTaxable: boolean;
  secondVault?: { enabled: boolean; vaultId: string; amount: string };
}): string | null {
  const { form, selectedLine, secondVault } = params;
  if (!form.expenseLineId) return 'expenseLineRequired';
  const total = parseOptionalMoney(form.totalAmount);
  if (total == null || total <= 0) return 'amountPositiveRequired';
  if (!selectedLine) return 'expenseLineInvalid';
  if (
    isExpenseSupplierInvoiceNumberRequired(selectedLine, params.isTaxable) &&
    !form.supplierInvoiceNumber.trim()
  ) return 'expenseSupplierInvoiceRequired';
  if (!form.primaryVaultId.trim()) return 'selectVault';
  if (isExpensePaymentAmountLocked(selectedLine)) {
    const referenceAmount = parseOptionalMoney(String(selectedLine.referenceAmount ?? ''));
    if (referenceAmount != null && Math.abs(total - referenceAmount) > 0.009) return 'expensePaymentAmountLocked';
  }
  if (selectedLine.kind === 'fixed_expense') {
    const coverageError = validateFixedExpenseCoverage(form);
    if (coverageError) return coverageError;
  }
  if (secondVault?.enabled) {
    const secondAmount = parseOptionalMoney(secondVault.amount);
    if (!secondVault.vaultId.trim()) return 'selectVault';
    if (secondVault.vaultId === form.primaryVaultId) return 'invoiceVaultsMustDiffer';
    if (secondAmount == null || secondAmount <= 0) return 'secondVaultAmountInvalid';
    if (secondAmount >= total - 0.01) return 'vaultSplitsMustMatchTotal';
    if (roundMoney(total - secondAmount) <= 0) return 'vaultSplitsMustMatchTotal';
  }
  return null;
}

export function validateFixedExpenseCoverage(form: ExpensePaymentFormState): string | null {
  const year = Number(form.expenseCoverageYear);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return 'expenseCoverageYearInvalid';
  if (form.coverageMode === 'quarter') return null;
  const start = Number(form.expenseCoverageMonthStart);
  const count = Number(form.expenseMonthsCovered);
  if (!Number.isFinite(start) || !Number.isFinite(count)) return 'expenseCoverageRangeInvalid';
  if (start < 1 || start > 12 || count < 1 || count > 12 || start + count - 1 > 12) return 'expenseCoverageRangeInvalid';
  return null;
}

export function canShowExpensePaymentExemption(line: ExpenseLineRecord | undefined): boolean {
  return canExemptThisExpensePayment(line);
}
