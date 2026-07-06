import { getSaudiToday } from '../../../utils/saudiDate';
import type { BatchTranslateFn, PurchaseBatchEntryRow } from './purchaseBatchTypes';

export const PAGE_SIZE = 50;

export const PURCHASE_TAB_IDS = ['entry', 'history'] as const;

let purchaseBatchRowKeySeed = 0;

export function getPurchaseBatchTabs(t: BatchTranslateFn) {
  return [
    { id: 'entry', label: t('tabNewBatch'), icon: '' },
    { id: 'history', label: t('tabSavedBatches'), icon: '' },
  ] satisfies Array<{ id: (typeof PURCHASE_TAB_IDS)[number]; label: string; icon: string }>;
}

export function createEmptyPurchasesBatchRow(): PurchaseBatchEntryRow {
  purchaseBatchRowKeySeed += 1;
  return {
    key: `purchase-batch-row-${purchaseBatchRowKeySeed}`,
    supplierId: '',
    invoiceNumber: '',
    totalInclusive: '',
    invoiceDate: getSaudiToday(),
    kind: 'purchase',
    isTaxable: true,
    categoryId: '',
    debitAccountId: '',
    notes: '',
    warrantyFollowUp: false,
    attachmentFile: null,
  };
}
