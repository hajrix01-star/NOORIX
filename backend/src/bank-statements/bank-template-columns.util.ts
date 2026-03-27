export type ColumnMappingLike = {
  dateCol?: number;
  descCol?: number;
  notesCol?: number;
  mergeNotesWithDescription?: boolean;
  debitCol?: number;
  creditCol?: number;
  amountCol?: number;
  balanceCol?: number;
  refCol?: number;
};

export type TemplateColumnEntry = { index: number; merge_with_description?: boolean };
export type TemplateColumnsJson = Record<string, TemplateColumnEntry>;

export function templateColumnsToMapping(cols: TemplateColumnsJson): ColumnMappingLike {
  const m: ColumnMappingLike = {};
  if (cols.date?.index != null && cols.date.index >= 0) m.dateCol = cols.date.index;
  if (cols.description?.index != null && cols.description.index >= 0) m.descCol = cols.description.index;
  if (cols.notes?.index != null && cols.notes.index >= 0) {
    m.notesCol = cols.notes.index;
    m.mergeNotesWithDescription = cols.notes.merge_with_description !== false;
  }
  if (cols.debit?.index != null && cols.debit.index >= 0) m.debitCol = cols.debit.index;
  if (cols.credit?.index != null && cols.credit.index >= 0) m.creditCol = cols.credit.index;
  if (cols.balance?.index != null && cols.balance.index >= 0) m.balanceCol = cols.balance.index;
  if (cols.reference?.index != null && cols.reference.index >= 0) m.refCol = cols.reference.index;
  if (cols.amount?.index != null && cols.amount.index >= 0) m.amountCol = cols.amount.index;
  return m;
}

export function columnMappingToTemplateColumns(map: ColumnMappingLike): TemplateColumnsJson {
  const c: TemplateColumnsJson = {};
  if (map.dateCol != null && map.dateCol >= 0) c.date = { index: map.dateCol };
  if (map.descCol != null && map.descCol >= 0) c.description = { index: map.descCol };
  if (map.notesCol != null && map.notesCol >= 0) {
    c.notes = { index: map.notesCol, merge_with_description: map.mergeNotesWithDescription !== false };
  }
  if (map.debitCol != null && map.debitCol >= 0) c.debit = { index: map.debitCol };
  if (map.creditCol != null && map.creditCol >= 0) c.credit = { index: map.creditCol };
  if (map.balanceCol != null && map.balanceCol >= 0) c.balance = { index: map.balanceCol };
  if (map.refCol != null && map.refCol >= 0) c.reference = { index: map.refCol };
  if (map.amountCol != null && map.amountCol >= 0) c.amount = { index: map.amountCol };
  return c;
}
