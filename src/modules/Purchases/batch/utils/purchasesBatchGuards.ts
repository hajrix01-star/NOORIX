import { isPurchaseBatchLineValid } from '@noorix/finance-core';
import type { PurchaseBatchEntryRow } from '../purchaseBatchTypes';

export function isRowValidForBatchSave(row: PurchaseBatchEntryRow, batchNotesTrimmed: string): boolean {
  return isPurchaseBatchLineValid(row, batchNotesTrimmed);
}

export function filterValidRowsForBatchSave(
  rows: PurchaseBatchEntryRow[],
  batchNotesTrimmed: string,
): PurchaseBatchEntryRow[] {
  return rows.filter((r) => isRowValidForBatchSave(r, batchNotesTrimmed));
}
