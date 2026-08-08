import type { VaultTransactionViewRow } from '../../types/api';
import { buildPrintHtmlTable, escapePrintHtml } from '../../utils/printTableHtml';

export type VaultTransactionsPrintLabels = {
  documentNumber: string;
  date: string;
  type: string;
  notes: string;
  debit: string;
  credit: string;
  total: string;
  totalIn: string;
  totalOut: string;
  periodNet: string;
  transactionCount: string;
};

type VaultTransactionsPrintInput = {
  rows: VaultTransactionViewRow[];
  totalIn: number;
  totalOut: number;
  periodBalance: number;
  totalTransactions: number;
  labels: VaultTransactionsPrintLabels;
  typeLabels: Record<string, string>;
  formatDate: (value: string) => string;
  formatAmount: (value: number) => string;
};

export function vaultTransactionTypeLabel(
  referenceType: string | null | undefined,
  typeLabels: Record<string, string>,
): string {
  const normalized = String(referenceType || '').trim().toLowerCase();
  return typeLabels[normalized] || String(referenceType || '-');
}

function summaryCard(label: string, value: string, className: string): string {
  return `<div class="vault-print-summary__card ${className}">
    <span>${escapePrintHtml(label)}</span>
    <strong dir="ltr">${escapePrintHtml(value)}</strong>
  </div>`;
}

export function buildVaultTransactionsPrintBody(input: VaultTransactionsPrintInput): string {
  const summary = `<section class="vault-print-summary">
    ${summaryCard(input.labels.totalIn, input.formatAmount(input.totalIn), 'is-in')}
    ${summaryCard(input.labels.totalOut, input.formatAmount(input.totalOut), 'is-out')}
    ${summaryCard(input.labels.periodNet, input.formatAmount(input.periodBalance), 'is-net')}
    ${summaryCard(input.labels.transactionCount, String(input.totalTransactions), 'is-count')}
  </section>`;

  const table = buildPrintHtmlTable({
    tableClassName: 'vault-print-table',
    wrapperClassName: 'vault-print-table-wrap',
    emptyMessage: '-',
    emptyColSpan: 6,
    headerRows: [{ cells: [
      { value: input.labels.documentNumber },
      { value: input.labels.date },
      { value: input.labels.type },
      { value: input.labels.notes },
      { value: input.labels.debit, align: 'center' },
      { value: input.labels.credit, align: 'center' },
    ] }],
    bodyRows: input.rows.map((row) => ({ cells: [
      { value: row.documentNumber || row.referenceId || '-', className: 'vault-print-reference' },
      { value: input.formatDate(row.transactionDate), className: 'vault-print-date' },
      { value: vaultTransactionTypeLabel(row.referenceType, input.typeLabels), className: 'vault-print-type' },
      { value: row.notesDisplay || '-', className: 'vault-print-notes' },
      { value: row.debit == null ? '-' : input.formatAmount(row.debit), className: 'vault-print-amount is-in', align: 'center' },
      { value: row.credit == null ? '-' : input.formatAmount(row.credit), className: 'vault-print-amount is-out', align: 'center' },
    ] })),
    footerRows: input.rows.length ? [{ cells: [
      { value: input.labels.total, colSpan: 4, className: 'vault-print-total-label' },
      { value: input.formatAmount(input.totalIn), className: 'vault-print-amount is-in', align: 'center' },
      { value: input.formatAmount(input.totalOut), className: 'vault-print-amount is-out', align: 'center' },
    ] }] : [],
  });

  return `${summary}${table}`;
}

export const VAULT_TRANSACTIONS_PRINT_CSS = `
.print-header { padding-bottom: 9px; margin-bottom: 12px; border-bottom-width: 1px; }
.print-header img { max-height: 42px; margin-bottom: 4px; }
.print-header h1 { font-size: 18px; margin-bottom: 2px; }
.print-header .sub { font-size: 11px; }
.vault-print-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 12px;
}
.vault-print-summary__card {
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #f8fafc;
  padding: 8px 10px;
  text-align: center;
}
.vault-print-summary__card span { display: block; color: #475569; font-size: 10px; margin-bottom: 2px; }
.vault-print-summary__card strong { display: block; color: #0f172a; font-size: 14px; line-height: 1.25; }
.vault-print-summary__card.is-in strong { color: #087a55; }
.vault-print-summary__card.is-out strong { color: #b42318; }
.vault-print-table-wrap { width: 100%; overflow: visible; }
.vault-print-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10.5px; line-height: 1.35; }
.vault-print-table thead { display: table-header-group; }
.vault-print-table tfoot { display: table-row-group; }
.vault-print-table tr { break-inside: avoid; page-break-inside: avoid; }
.vault-print-table th {
  background: #eaf2f8;
  color: #16324f;
  border: 1px solid #b9cad8;
  padding: 7px 6px;
  text-align: center;
  font-weight: 800;
}
.vault-print-table td { border: 1px solid #d5dde5; padding: 5px 7px; vertical-align: middle; }
.vault-print-table tbody tr:nth-child(even) td { background: #f8fafc; }
.vault-print-table th:nth-child(1), .vault-print-table td:nth-child(1) { width: 21%; }
.vault-print-table th:nth-child(2), .vault-print-table td:nth-child(2) { width: 12%; }
.vault-print-table th:nth-child(3), .vault-print-table td:nth-child(3) { width: 14%; }
.vault-print-table th:nth-child(4), .vault-print-table td:nth-child(4) { width: 29%; }
.vault-print-table th:nth-child(5), .vault-print-table td:nth-child(5),
.vault-print-table th:nth-child(6), .vault-print-table td:nth-child(6) { width: 12%; }
.vault-print-reference, .vault-print-date, .vault-print-amount {
  direction: ltr;
  unicode-bidi: embed;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.vault-print-reference, .vault-print-date, .vault-print-type { text-align: center; }
.vault-print-notes { overflow-wrap: anywhere; }
.vault-print-amount.is-in { color: #087a55; font-weight: 700; }
.vault-print-amount.is-out { color: #b42318; font-weight: 700; }
.vault-print-table tfoot td { background: #eef3f7; border-top: 2px solid #7890a4; font-weight: 800; }
.vault-print-total-label { text-align: start; }
.print-footer { margin-top: 14px; padding-top: 6px; font-size: 9px; }
@media print {
  .vault-print-summary, .vault-print-table, .vault-print-table th, .vault-print-table td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`.trim();
