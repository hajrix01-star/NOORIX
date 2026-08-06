import Decimal from 'decimal.js';
import { splitTaxFromTotalAsNumbers, TAX_RATE } from '../math-engine';

export type PurchaseBatchLineLike = {
  kind?: string | null;
  supplierId?: string | null;
  expenseLineId?: string | null;
  invoiceNumber?: string | null;
  supplierInvoiceNumber?: string | null;
  totalInclusive?: string | number | null;
  totalAmount?: string | number | null;
  isTaxable?: boolean | null;
  notes?: string | null;
  invoiceDate?: string | null;
  categoryId?: string | null;
  debitAccountId?: string | null;
  warrantyFollowUp?: boolean | null;
};

export type NormalizedPurchaseBatchLine = {
  kind: string;
  supplierId?: string;
  expenseLineId?: string;
  invoiceNumber?: string;
  supplierInvoiceNumber?: string;
  totalInclusive: number;
  totalAmount: number;
  isTaxable: boolean;
  notes?: string;
  invoiceDate?: string;
  categoryId?: string;
  debitAccountId?: string;
  warrantyFollowUp?: boolean;
};

export type PurchaseBatchSummary = {
  count: number;
  net: number;
  tax: number;
  total: number;
};

export type PurchaseBatchIdempotencyInput = {
  companyId?: string | null;
  storeId?: string | null;
  cashAccountId?: string | null;
  vaultId?: string | null;
  operationDate?: string | null;
  transactionDate?: string | null;
  batchNotes?: string | null;
  rows: PurchaseBatchLineLike[];
};

function trimToUndefined(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
}

function decimalAmount(row: PurchaseBatchLineLike): Decimal {
  return new Decimal(row.totalInclusive ?? row.totalAmount ?? 0);
}

function numericAmount(row: PurchaseBatchLineLike): number {
  const amount = decimalAmount(row);
  return amount.isFinite() ? amount.toNumber() : 0;
}

/**
 * Supplier invoice references are only mandatory for taxable purchases and
 * variable expenses. Fixed expenses and government/HR expenses may be
 * recorded without an external invoice number.
 */
export function isSupplierInvoiceNumberRequired(
  row: Pick<
    PurchaseBatchLineLike,
    'kind' | 'supplierId' | 'expenseLineId' | 'isTaxable'
  >,
): boolean {
  const kind = trimToUndefined(row.kind) ?? 'purchase';
  const hasSupplierContext = Boolean(
    trimToUndefined(row.supplierId) || trimToUndefined(row.expenseLineId),
  );
  return (
    hasSupplierContext &&
    row.isTaxable !== false &&
    (kind === 'purchase' || kind === 'expense')
  );
}

export function normalizePurchaseBatchLine(row: PurchaseBatchLineLike): NormalizedPurchaseBatchLine {
  const invoiceNumber = trimToUndefined(row.invoiceNumber);
  const supplierInvoiceNumber = trimToUndefined(row.supplierInvoiceNumber) ?? invoiceNumber;
  const amount = numericAmount(row);
  return {
    kind: trimToUndefined(row.kind) ?? 'purchase',
    supplierId: trimToUndefined(row.supplierId),
    expenseLineId: trimToUndefined(row.expenseLineId),
    invoiceNumber,
    supplierInvoiceNumber,
    totalInclusive: amount,
    totalAmount: amount,
    isTaxable: row.isTaxable !== false,
    notes: trimToUndefined(row.notes),
    invoiceDate: trimToUndefined(row.invoiceDate),
    categoryId: trimToUndefined(row.categoryId),
    debitAccountId: trimToUndefined(row.debitAccountId),
    warrantyFollowUp: row.warrantyFollowUp === true ? true : undefined,
  };
}

export function isPurchaseBatchLineValid(
  row: PurchaseBatchLineLike,
  batchNotesTrimmed: string,
): boolean {
  try {
    const normalized = normalizePurchaseBatchLine(row);
    if (new Decimal(normalized.totalAmount || 0).lte(0)) return false;

    if (isSupplierInvoiceNumberRequired(normalized)) {
      return !!(normalized.supplierInvoiceNumber || normalized.invoiceNumber);
    }

    if (normalized.supplierId || normalized.expenseLineId) return true;

    if (
      (normalized.kind === 'expense' || normalized.kind === 'fixed_expense') &&
      (normalized.notes || batchNotesTrimmed)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function calculatePurchaseBatchSummary(
  rows: PurchaseBatchLineLike[],
  batchNotesTrimmed: string,
  vatRateDecimal: number = TAX_RATE,
): PurchaseBatchSummary {
  return rows.reduce<PurchaseBatchSummary>(
    (summary, row) => {
      if (!isPurchaseBatchLineValid(row, batchNotesTrimmed)) return summary;
      const normalized = normalizePurchaseBatchLine(row);
      const total = normalized.totalAmount;
      const split = splitTaxFromTotalAsNumbers(total, normalized.isTaxable, vatRateDecimal);
      return {
        count: summary.count + 1,
        net: summary.net + split.net,
        tax: summary.tax + split.tax,
        total: summary.total + total,
      };
    },
    { count: 0, net: 0, tax: 0, total: 0 },
  );
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableLineForIdempotency(row: NormalizedPurchaseBatchLine) {
  return {
    kind: row.kind,
    supplierId: row.supplierId ?? '',
    expenseLineId: row.expenseLineId ?? '',
    invoiceNumber: row.supplierInvoiceNumber ?? row.invoiceNumber ?? '',
    totalInclusive: new Decimal(row.totalAmount || 0).toFixed(2),
    isTaxable: row.isTaxable,
    notes: row.notes ?? '',
  };
}

export function buildPurchaseBatchIdempotencyKey(input: PurchaseBatchIdempotencyInput): string {
  const batchNotes = trimToUndefined(input.batchNotes) ?? '';
  const operationDate = trimToUndefined(input.operationDate ?? input.transactionDate) ?? '';
  const cashAccountId = trimToUndefined(input.cashAccountId ?? input.vaultId) ?? '';
  const validRows = input.rows
    .filter((row) => isPurchaseBatchLineValid(row, batchNotes))
    .map((row) => stableLineForIdempotency(normalizePurchaseBatchLine(row)));

  const payload = {
    companyId: trimToUndefined(input.companyId) ?? '',
    storeId: trimToUndefined(input.storeId) ?? '',
    cashAccountId,
    operationDate,
    batchNotes,
    rows: validRows,
  };

  return `purchase-batch:${stableHash(JSON.stringify(payload))}`;
}
