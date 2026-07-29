import type {
  ExpenseLinePaymentRecord,
  ExpenseLinePaymentSummary,
  VaultRecord,
} from '../../types/api';
import { fmt, sumAmounts } from '../../utils/format';
import { formatSaudiDate } from '../../utils/saudiDate';
import { vaultDisplayName } from '../../utils/vaultDisplay';
import {
  type ExpenseLang,
  type ExpensePaymentExportSource,
  expenseLineDisplayName,
  expenseLineKindLabel,
  expenseSupplierDisplayName,
} from './expenseSharedModels';

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
