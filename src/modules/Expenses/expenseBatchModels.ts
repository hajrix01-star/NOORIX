import { splitTaxFromTotalAsNumbers } from '@noorix/finance-core';
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
    if (
      isExpenseSupplierInvoiceNumberRequired(line, taxable) &&
      !row.supplierInvoiceNumber.trim()
    ) return false;
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
