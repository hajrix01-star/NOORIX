import { roundAmountAsNumber, splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
import type {
  ExpenseBatchCreatePayload,
  ExpenseBatchItemPayload,
  ExpenseLineRecord,
} from '../../types/api';
import { isExpenseSupplierInvoiceNumberRequired, isExpensePaymentTaxable } from './utils/expenseTax';
import {
  type ExpenseBatchRow,
  type ExpenseBatchViewRow,
  type ExpenseDraftSummary,
  type ExpenseLang,
  expenseCategoryDisplayName,
  expenseLineDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
  parseOptionalMoney,
  parseRequiredMoney,
} from './expenseSharedModels';

export const EXPENSE_BATCH_INVALID_ROWS_ERROR = 'EXPENSE_BATCH_INVALID_ROWS';

export type ExpenseBatchRowErrorKey =
  | 'expenseBatchLineRequired'
  | 'expenseBatchLineInvalid'
  | 'expenseBatchAmountRequired'
  | 'expenseBatchSupplierInvoiceRequired';

export type ExpenseBatchRowValidation = {
  isEmpty: boolean;
  isCalculable: boolean;
  isValid: boolean;
  amount: number | null;
  taxable: boolean;
  supplierInvoiceNumberRequired: boolean;
  expenseLineError?: ExpenseBatchRowErrorKey;
  amountError?: ExpenseBatchRowErrorKey;
  supplierInvoiceNumberError?: ExpenseBatchRowErrorKey;
};

export function isExpenseBatchRowEmpty(row: ExpenseBatchRow): boolean {
  return (
    !row.expenseLineId.trim() &&
    !row.supplierInvoiceNumber.trim() &&
    !row.totalInclusive.trim() &&
    !row.notes.trim() &&
    !row.warrantyFollowUp &&
    !row.exemptThisPayment
  );
}

export function validateExpenseBatchRow(
  row: ExpenseBatchRow,
  expenseLines: ExpenseLineRecord[],
): ExpenseBatchRowValidation {
  const isEmpty = isExpenseBatchRowEmpty(row);
  if (isEmpty) {
    return {
      isEmpty: true,
      isCalculable: false,
      isValid: false,
      amount: null,
      taxable: false,
      supplierInvoiceNumberRequired: false,
    };
  }

  const line = expenseLines.find((item) => item.id === row.expenseLineId);
  const amount = parseOptionalMoney(row.totalInclusive);
  const taxable = isExpensePaymentTaxable(line, row.exemptThisPayment);
  const supplierInvoiceNumberRequired = isExpenseSupplierInvoiceNumberRequired(line, taxable);
  const expenseLineError: ExpenseBatchRowErrorKey | undefined =
    !row.expenseLineId.trim()
      ? 'expenseBatchLineRequired'
      : !line
        ? 'expenseBatchLineInvalid'
        : undefined;
  const amountError: ExpenseBatchRowErrorKey | undefined =
    amount == null || amount <= 0 ? 'expenseBatchAmountRequired' : undefined;
  const supplierInvoiceNumberError: ExpenseBatchRowErrorKey | undefined =
    supplierInvoiceNumberRequired && !row.supplierInvoiceNumber.trim()
      ? 'expenseBatchSupplierInvoiceRequired'
      : undefined;

  return {
    isEmpty: false,
    isCalculable: Boolean(line && amount != null && amount > 0),
    isValid: !expenseLineError && !amountError && !supplierInvoiceNumberError,
    amount,
    taxable,
    supplierInvoiceNumberRequired,
    ...(expenseLineError ? { expenseLineError } : {}),
    ...(amountError ? { amountError } : {}),
    ...(supplierInvoiceNumberError ? { supplierInvoiceNumberError } : {}),
  };
}

export function invalidExpenseBatchRows(
  rows: ExpenseBatchRow[],
  expenseLines: ExpenseLineRecord[],
): ExpenseBatchRow[] {
  return rows.filter((row) => {
    const validation = validateExpenseBatchRow(row, expenseLines);
    return !validation.isEmpty && !validation.isValid;
  });
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
  return rows.filter((row) => validateExpenseBatchRow(row, expenseLines).isValid);
}

export function summarizeExpenseBatchDraft(
  rows: ExpenseBatchRow[],
  expenseLines: ExpenseLineRecord[],
  vatRateDecimal: number,
): ExpenseDraftSummary {
  let totalNet = 0;
  let totalTax = 0;
  let total = 0;
  const validations = rows.map((row) => validateExpenseBatchRow(row, expenseLines));
  for (let index = 0; index < rows.length; index += 1) {
    const validation = validations[index];
    if (!validation.isCalculable || validation.amount == null) continue;
    const amount = validation.amount;
    const { net, tax } = splitTaxFromTotalAsNumbers(amount, validation.taxable, vatRateDecimal);
    totalNet += net;
    totalTax += tax;
    total += amount;
  }
  return {
    totalNet: roundAmountAsNumber(totalNet),
    totalTax: roundAmountAsNumber(totalTax),
    total: roundAmountAsNumber(total),
    count: validations.filter((validation) => validation.isValid).length,
    invalidCount: validations.filter((validation) => !validation.isEmpty && !validation.isValid).length,
    draftCount: validations.filter((validation) => validation.isCalculable).length,
  };
}

export function buildExpenseBatchPayload(params: {
  companyId: string;
  batchDate: string;
  vaultId: string;
  rows: ExpenseBatchRow[];
  expenseLines: ExpenseLineRecord[];
  idempotencyKey: string;
}): ExpenseBatchCreatePayload {
  const invalidRows = invalidExpenseBatchRows(params.rows, params.expenseLines);
  if (invalidRows.length > 0) {
    throw new Error(EXPENSE_BATCH_INVALID_ROWS_ERROR);
  }
  const validRows = validExpenseBatchRows(params.rows, params.expenseLines);
  return {
    companyId: params.companyId,
    transactionDate: params.batchDate,
    vaultId: params.vaultId,
    idempotencyKey: params.idempotencyKey,
    items: validRows.map((row): ExpenseBatchItemPayload => {
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
