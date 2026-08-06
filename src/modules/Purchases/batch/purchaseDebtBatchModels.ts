import type { PurchaseDebtCreateInput } from '../../../services/api';

export type PurchaseDebtBatchRow = {
  key: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  totalAmount: string;
  isTaxable: boolean;
  notes: string;
};

export type PurchaseDebtBatchRowErrors = Partial<Record<
  'supplierId' | 'supplierInvoiceNumber' | 'invoiceDate' | 'totalAmount' | 'duplicate',
  string
>>;

export type PurchaseDebtBatchValidation = {
  items: PurchaseDebtCreateInput[];
  errorsByKey: Map<string, PurchaseDebtBatchRowErrors>;
  enteredCount: number;
  totalAmount: number;
};

const EASTERN_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeInvoiceKey(raw: string) {
  return raw
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[٠-٩]/g, (char) => String(EASTERN_ARABIC_DIGITS.indexOf(char)))
    .replace(/[۰-۹]/g, (char) => String(PERSIAN_DIGITS.indexOf(char)))
    .toLowerCase();
}

export function createPurchaseDebtBatchRow(seed: number, today: string): PurchaseDebtBatchRow {
  return {
    key: `purchase-debt-row-${seed}`,
    supplierId: '',
    supplierInvoiceNumber: '',
    invoiceDate: today,
    totalAmount: '',
    isTaxable: true,
    notes: '',
  };
}

export function buildPurchaseDebtBatchRows(count: number, today: string, startAt = 1) {
  return Array.from({ length: count }, (_, index) => createPurchaseDebtBatchRow(startAt + index, today));
}

export function isPurchaseDebtBatchRowEmpty(row: PurchaseDebtBatchRow) {
  return !row.supplierId.trim()
    && !row.supplierInvoiceNumber.trim()
    && !row.totalAmount.trim()
    && !row.notes.trim();
}

export function validatePurchaseDebtBatchRows(
  rows: PurchaseDebtBatchRow[],
  today: string,
  messages: {
    supplier: string;
    invoice: string;
    date: string;
    futureDate: string;
    amount: string;
    duplicate: string;
  },
): PurchaseDebtBatchValidation {
  const errorsByKey = new Map<string, PurchaseDebtBatchRowErrors>();
  const duplicateGroups = new Map<string, string[]>();
  const items: PurchaseDebtCreateInput[] = [];
  let enteredCount = 0;
  let totalAmount = 0;

  for (const row of rows) {
    if (isPurchaseDebtBatchRowEmpty(row)) continue;
    enteredCount += 1;
    const errors: PurchaseDebtBatchRowErrors = {};
    const invoiceNumber = row.supplierInvoiceNumber.trim();
    const amount = Number(row.totalAmount);
    if (!row.supplierId.trim()) errors.supplierId = messages.supplier;
    if (!invoiceNumber || invoiceNumber.length > 120) errors.supplierInvoiceNumber = messages.invoice;
    if (!row.invoiceDate) errors.invoiceDate = messages.date;
    else if (row.invoiceDate > today) errors.invoiceDate = messages.futureDate;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) errors.totalAmount = messages.amount;

    if (row.supplierId && invoiceNumber) {
      const key = `${row.supplierId}\u0001${normalizeInvoiceKey(invoiceNumber)}`;
      duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), row.key]);
    }
    if (Object.keys(errors).length > 0) errorsByKey.set(row.key, errors);
    if (Object.keys(errors).length === 0) {
      items.push({
        supplierId: row.supplierId,
        supplierInvoiceNumber: invoiceNumber,
        invoiceDate: row.invoiceDate,
        totalAmount: amount,
        isTaxable: row.isTaxable,
        ...(row.notes.trim() ? { notes: row.notes.trim() } : {}),
      });
      totalAmount += amount;
    }
  }

  for (const keys of duplicateGroups.values()) {
    if (keys.length < 2) continue;
    for (const key of keys) {
      errorsByKey.set(key, { ...(errorsByKey.get(key) || {}), duplicate: messages.duplicate });
    }
  }

  if (errorsByKey.size > 0) {
    return { items: [], errorsByKey, enteredCount, totalAmount: 0 };
  }
  return { items, errorsByKey, enteredCount, totalAmount };
}
