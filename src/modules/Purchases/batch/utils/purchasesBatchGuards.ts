import Decimal from 'decimal.js';

/** Same validity rule as inline filter in save mutation */
export function isRowValidForBatchSave(row: any, batchNotesTrimmed: string): boolean {
  try {
    if (!row.invoiceNumber || new Decimal(row.totalInclusive || 0).lte(0)) return false;
    if (row.supplierId) return true;
    if ((row.kind === 'fixed_expense' || row.kind === 'expense') && (row.notes?.trim() || batchNotesTrimmed)) return true;
    return false;
  } catch {
    return false;
  }
}

export function filterValidRowsForBatchSave(rows: any[], batchNotesTrimmed: string): any[] {
  return rows.filter((r) => isRowValidForBatchSave(r, batchNotesTrimmed));
}
