import type { PurchaseBatchLineLike } from '@noorix/finance-core';

export type PurchaseBatchLang = 'ar' | 'en' | string;
export type PurchaseBatchKind = 'purchase' | 'expense' | 'fixed_expense';
export type PurchaseBatchStatus = 'active' | 'cancelled' | 'partial' | string;
export type PurchaseBatchNumericValue = number | string | null | undefined;

export type PurchaseBatchNamedEntity = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
};

export type PurchaseBatchSupplierCategory = PurchaseBatchNamedEntity & {
  type?: string | null;
  accountId?: string | null;
  icon?: string | null;
  account?: {
    id?: string | null;
    taxExempt?: boolean | null;
  } | null;
};

export type PurchaseBatchSupplier = PurchaseBatchNamedEntity & {
  id: string;
  isBookmarked?: boolean | null;
  isTaxRegistered?: boolean | null;
  supplierCategoryId?: string | null;
  supplierCategory?: PurchaseBatchSupplierCategory | null;
};

export type PurchaseBatchVault = PurchaseBatchNamedEntity & {
  id: string;
  type?: string | null;
};

export type PurchaseBatchEntryRow = PurchaseBatchLineLike & {
  key: string;
  kind: PurchaseBatchKind;
  supplierId: string;
  invoiceNumber: string;
  totalInclusive: string;
  invoiceDate: string;
  isTaxable: boolean;
  categoryId: string;
  debitAccountId: string;
  notes: string;
  warrantyFollowUp: boolean;
  attachmentFile: File | null;
};

export type PurchaseBatchSummaryRow = {
  batchId: string;
  invoices: PurchaseBatchInvoice[];
  transactionDate: string;
  invoiceCount: number;
  supplierNames: string;
  vaultName: string;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: PurchaseBatchStatus;
};

export type PurchaseBatchInvoice = {
  id: string;
  batchId?: string | null;
  invoiceNumber?: string | number | null;
  supplierInvoiceNumber?: string | number | null;
  supplierId?: string | null;
  supplier?: PurchaseBatchSupplier | null;
  transactionDate?: string | Date | null;
  kind?: string | null;
  status?: PurchaseBatchStatus | null;
  totalAmount?: PurchaseBatchNumericValue;
  netAmount?: PurchaseBatchNumericValue;
  taxAmount?: PurchaseBatchNumericValue;
  isTaxable?: boolean | null;
};

export type PurchaseBatchEditableInvoice = PurchaseBatchInvoice & {
  totalAmount: number | string;
  netAmount: number;
  taxAmount: number;
  transactionDate: string;
};

export type PurchaseBatchUpdateRowField = keyof PurchaseBatchEntryRow;
export type PurchaseBatchUpdateRowPatch = Partial<PurchaseBatchEntryRow>;
export type PurchaseBatchUpdateRow = (
  index: number,
  fieldOrPatch: PurchaseBatchUpdateRowField | PurchaseBatchUpdateRowPatch,
  value?: PurchaseBatchEntryRow[PurchaseBatchUpdateRowField],
) => void;

export type BatchTranslateFn = (key: string, ...args: unknown[]) => string;
