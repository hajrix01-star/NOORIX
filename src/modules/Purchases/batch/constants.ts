import { getSaudiToday } from '../../../utils/saudiDate';

export const PAGE_SIZE = 50;

export const PURCHASE_TAB_IDS = ['entry', 'history'] as const;

export function getPurchaseBatchTabs(t: (key: string, ...args: unknown[]) => string) {
  return [
    { id: 'entry', label: t('tabNewBatch'), icon: '' },
    { id: 'history', label: t('tabSavedBatches'), icon: '' },
  ];
}

/** Row factory — same shape as legacy EMPTY_ROW */
export function createEmptyPurchasesBatchRow() {
  return {
    key: `${Date.now()}-${Math.random()}`,
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
    attachmentFile: null as File | null,
  };
}
