import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import type {
  ExpenseBatchCreatePayload,
  ExpenseBatchItemPayload,
  ExpenseCategoryRef,
  ExpenseLineCreatePayload,
  ExpenseLineKind,
  ExpenseLinePaymentRecord,
  ExpenseLinePaymentSummary,
  ExpenseLineRecord,
  ExpenseLineUpdatePayload,
  ExpensePaymentCreatePayload,
  ExpenseSupplierRef,
  VaultRecord,
} from '../../types/api';
import { fmt, sumAmounts } from '../../utils/format';
import { formatSaudiDate, getSaudiToday } from '../../utils/saudiDate';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import {
  canExemptThisExpensePayment,
  isExpensePaymentTaxable,
} from './utils/expenseTax';

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
  return lang === 'en'
    ? line.nameEn || line.name || line.nameAr || ''
    : line.nameAr || line.name || line.nameEn || '';
}

export function expenseSupplierDisplayName(supplier: ExpenseSupplierRef | null | undefined, lang: ExpenseLang): string {
  if (!supplier) return '-';
  return lang === 'en'
    ? supplier.nameEn || supplier.name || supplier.nameAr || '-'
    : supplier.nameAr || supplier.name || supplier.nameEn || '-';
}

export function expenseCategoryDisplayName(category: ExpenseCategoryRef | null | undefined, lang: ExpenseLang): string {
  if (!category) return '-';
  return lang === 'en'
    ? category.nameEn || category.nameAr || '-'
    : category.nameAr || category.nameEn || '-';
}

export function expenseLineKindLabel(kind: ExpenseLineKind | string | null | undefined, lang: ExpenseLang): string {
  if (kind === 'fixed_expense') return lang === 'en' ? 'Fixed' : 'ثابت';
  return lang === 'en' ? 'Variable' : 'متغير';
}

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
  if (params.isTaxable && !form.supplierInvoiceNumber.trim()) return 'expenseSupplierInvoiceRequired';
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

export function createExpenseBatchRow(seed: number): ExpenseBatchRow {
  return {
    key: `expense-row-${seed}`,
    expenseLineId: '',
    supplierInvoiceNumber: '',
    totalInclusive: '',
    notes: '',
    warrantyFollowUp: false,
    exemptThisPayment: false,
  };
}

export function buildExpenseBatchRows(count: number, startAt = 1): ExpenseBatchRow[] {
  return Array.from({ length: count }, (_, index) => createExpenseBatchRow(startAt + index));
}

export function buildExpenseBatchViewRows(
  rows: ExpenseBatchRow[],
  expenseLines: ExpenseLineRecord[],
  lang: ExpenseLang,
  vatRateDecimal: number,
): ExpenseBatchViewRow[] {
  return rows.map((row, index) => {
    const line = expenseLines.find((item) => item.id === row.expenseLineId);
    const taxable = isExpensePaymentTaxable(line, row.exemptThisPayment);
    const { net, tax } = splitExpenseTaxDraft(row.totalInclusive, taxable, vatRateDecimal);
    return {
      ...row,
      index: index + 1,
      lineName: line ? expenseLineDisplayName(line, lang) : '-',
      categoryName: expenseCategoryDisplayName(line?.category, lang),
      supplierName: expenseSupplierDisplayName(line?.supplier, lang),
      kindLabel: expenseLineKindLabel(line?.kind, lang),
      net,
      tax,
    };
  });
}

export function validExpenseBatchRows(rows: ExpenseBatchRow[], expenseLines: ExpenseLineRecord[]): ExpenseBatchRow[] {
  return rows.filter((row) => {
    const amount = parseOptionalMoney(row.totalInclusive);
    if (!row.expenseLineId || amount == null || amount <= 0) return false;
    const line = expenseLines.find((item) => item.id === row.expenseLineId);
    const taxable = isExpensePaymentTaxable(line, row.exemptThisPayment);
    if (taxable && !row.supplierInvoiceNumber.trim()) return false;
    return Boolean(line);
  });
}

export function summarizeExpenseBatchDraft(
  rows: ExpenseBatchRow[],
  expenseLines: ExpenseLineRecord[],
  vatRateDecimal: number,
): ExpenseDraftSummary {
  let totalNet = 0;
  let totalTax = 0;
  let total = 0;
  for (const row of validExpenseBatchRows(rows, expenseLines)) {
    const line = expenseLines.find((item) => item.id === row.expenseLineId);
    const amount = parseRequiredMoney(row.totalInclusive);
    const taxable = isExpensePaymentTaxable(line, row.exemptThisPayment);
    const { net, tax } = splitTaxFromTotalAsNumbers(amount, taxable, vatRateDecimal);
    totalNet += net;
    totalTax += tax;
    total += amount;
  }
  return { totalNet, totalTax, total, count: validExpenseBatchRows(rows, expenseLines).length };
}

export function buildExpenseBatchPayload(params: {
  companyId: string;
  batchDate: string;
  vaultId: string;
  rows: ExpenseBatchRow[];
  expenseLines: ExpenseLineRecord[];
  idempotencyKey: string;
}): ExpenseBatchCreatePayload {
  return {
    companyId: params.companyId,
    transactionDate: params.batchDate,
    vaultId: params.vaultId,
    idempotencyKey: params.idempotencyKey,
    items: validExpenseBatchRows(params.rows, params.expenseLines).map((row): ExpenseBatchItemPayload => {
      const line = params.expenseLines.find((item) => item.id === row.expenseLineId);
      if (!line) throw new Error('Invalid expense line');
      const lineName = expenseLineDisplayName(line, 'ar') || expenseLineDisplayName(line, 'en');
      const userNote = row.notes.trim();
      const notes = lineName ? (userNote ? `${lineName} - ${userNote}` : lineName) : userNote || undefined;
      return {
        expenseLineId: row.expenseLineId,
        ...(row.supplierInvoiceNumber.trim() ? { supplierInvoiceNumber: row.supplierInvoiceNumber.trim() } : {}),
        kind: line.kind,
        totalAmount: parseRequiredMoney(row.totalInclusive),
        isTaxable: isExpensePaymentTaxable(line, row.exemptThisPayment),
        ...(notes ? { notes } : {}),
        ...(row.warrantyFollowUp ? { warrantyFollowUp: true } : {}),
      };
    }),
  };
}

export function splitExpenseTaxDraft(total: string | number, taxable: boolean, vatRateDecimal: number): { net: number; tax: number } {
  const amount = parseOptionalMoney(total);
  if (amount == null || amount <= 0) return { net: 0, tax: 0 };
  return splitTaxFromTotalAsNumbers(amount, taxable, vatRateDecimal);
}

export function summarizeExpensePaymentsFromBackend(summary: ExpenseLinePaymentSummary | undefined): ExpenseLinePaymentSummary {
  return summary ?? { totalNet: 0, totalTax: 0, totalAmount: 0, count: 0 };
}

export function summarizeInvoiceListPayments(items: Array<{ netAmount?: unknown; taxAmount?: unknown; totalAmount?: unknown }>): ExpenseLinePaymentSummary {
  return {
    totalNet: sumAmounts(items, 'netAmount').toNumber(),
    totalTax: sumAmounts(items, 'taxAmount').toNumber(),
    totalAmount: sumAmounts(items, 'totalAmount').toNumber(),
    count: items.length,
  };
}

export function formatExpenseCoverage(row: Pick<ExpenseLinePaymentRecord, 'expenseCoverageYear' | 'expenseCoverageQuarter' | 'expenseCoverageMonthStart' | 'expenseMonthsCovered'>): string {
  if (row.expenseCoverageYear == null) return '-';
  const year = row.expenseCoverageYear;
  if (row.expenseCoverageQuarter != null) return `Q${row.expenseCoverageQuarter} ${year}`;
  if (row.expenseCoverageMonthStart != null && row.expenseMonthsCovered != null) {
    return `${year}-${String(row.expenseCoverageMonthStart).padStart(2, '0')} (${row.expenseMonthsCovered})`;
  }
  return String(year);
}

export function buildExpensePaymentExportRows(
  payments: ExpensePaymentExportSource[],
  lang: ExpenseLang,
  labels: {
    documentNumber: string;
    supplierInvoiceNumber: string;
    supplier: string;
    expenseLine: string;
    kind: string;
    date: string;
    coverage: string;
    net: string;
    tax: string;
    total: string;
    vault: string;
    notes: string;
    attachment?: string;
  },
) {
  return payments.map((payment) => ({
    [labels.documentNumber]: payment.invoiceNumber || '-',
    [labels.supplierInvoiceNumber]: payment.supplierInvoiceNumber || '-',
    [labels.supplier]: expenseSupplierDisplayName(payment.supplier, lang),
    [labels.expenseLine]: payment.expenseLine ? expenseLineDisplayName({
      nameAr: payment.expenseLine.nameAr || '',
      nameEn: payment.expenseLine.nameEn,
    }, lang) : '-',
    [labels.kind]: expenseLineKindLabel(payment.expenseLine?.kind, lang),
    [labels.date]: payment.transactionDate ? formatSaudiDate(payment.transactionDate) : '-',
    [labels.coverage]: formatExpenseCoverage(payment),
    [labels.net]: Number(payment.netAmount || 0),
    [labels.tax]: Number(payment.taxAmount || 0),
    [labels.total]: Number(payment.totalAmount || 0),
    [labels.vault]: payment.vaultName || vaultDisplayName(payment.vault || {}, lang) || '-',
    [labels.notes]: payment.notes || '-',
    ...(labels.attachment ? { [labels.attachment]: payment.hasInvoiceAttachment ? payment.attachmentOriginalName || '-' : '-' } : {}),
  }));
}

export function formatExpenseSummarySubtitle(label: string, summary: ExpenseLinePaymentSummary): string {
  return `${label}: ${fmt(summary.totalAmount)} SR`;
}

export function paymentVaultOptions(vaults: VaultRecord[], lang: ExpenseLang): Array<{ value: string; label: string }> {
  return vaults.map((vault) => ({ value: vault.id, label: vaultDisplayName(vault, lang) }));
}

export function canShowExpensePaymentExemption(line: ExpenseLineRecord | undefined): boolean {
  return canExemptThisExpensePayment(line);
}

export function parseOptionalMoney(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parseRequiredMoney(value: unknown): number {
  return parseOptionalMoney(value) ?? 0;
}

function parseOptionalInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : null;
}

function moneyInputFromUnknown(value: unknown): string {
  const number = parseOptionalMoney(value);
  return number == null ? '' : String(number);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
