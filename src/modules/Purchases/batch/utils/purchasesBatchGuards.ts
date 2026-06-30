import { isPurchaseBatchLineValid } from '@noorix/finance-core';

export function isRowValidForBatchSave(row: any, batchNotesTrimmed: string): boolean {
  return isPurchaseBatchLineValid(row, batchNotesTrimmed);
}

export function filterValidRowsForBatchSave(rows: any[], batchNotesTrimmed: string): any[] {
  return rows.filter((r) => isRowValidForBatchSave(r, batchNotesTrimmed));
}
