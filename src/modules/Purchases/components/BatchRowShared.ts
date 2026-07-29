import type {
  PurchaseBatchEntryRow,
  PurchaseBatchKind,
  PurchaseBatchSupplier,
  PurchaseBatchSupplierCategory,
  PurchaseBatchUpdateRow,
} from '../batch/purchaseBatchTypes';

export type BatchRowSharedProps = {
  row: PurchaseBatchEntryRow;
  index: number;
  suppliers: PurchaseBatchSupplier[];
  categories: PurchaseBatchSupplierCategory[];
  bookmarkedIds: string[];
  onUpdate: PurchaseBatchUpdateRow;
  onRemove: (index: number) => void;
  onBookmark: (id: string) => void;
  maxInvoiceDate?: string;
  vatRateDecimal?: number;
};

export const BATCH_ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf,.jpg,.jpeg,.png,.webp';

export function dateErrorClass(maxInvoiceDate: string | undefined, invoiceDate: string) {
  return maxInvoiceDate && invoiceDate > maxInvoiceDate ? 'nx-batch-row-date-error' : '';
}

export function toPurchaseBatchKind(value: string): PurchaseBatchKind {
  if (value === 'expense' || value === 'fixed_expense') return value;
  return 'purchase';
}
