import type { CSSProperties } from 'react';
import type { SmartTableColumn, SmartTableColumnSize, SmartTableRow } from './types';

type ColumnKind = NonNullable<SmartTableColumn['kind']>;

const KIND_DEFAULTS: Record<ColumnKind, Partial<SmartTableColumn>> = {
  id: { align: 'center', shrink: true, width: '10ch' },
  text: { align: 'center', minWidth: '14ch' },
  date: { align: 'center', shrink: true, width: '11ch' },
  money: { align: 'center', numeric: true, shrink: true, width: '12ch' },
  number: { align: 'center', numeric: true, shrink: true, width: '8ch' },
  status: { align: 'center', shrink: true, width: '9ch' },
  actions: { align: 'center', shrink: true, width: '44px', maxWidth: '48px' },
  meta: { align: 'center', shrink: true, width: '10ch' },
};

const SIZE_DEFAULTS: Record<SmartTableColumnSize, Partial<SmartTableColumn>> = {
  document: { align: 'center', shrink: true, width: '10ch', maxWidth: '20ch' },
  name: { align: 'center', width: '22ch', minWidth: '18ch', maxWidth: '34ch' },
  supplier: { align: 'center', width: '18ch', minWidth: '14ch', maxWidth: '32ch' },
  date: { align: 'center', shrink: true, width: '10ch', maxWidth: '12ch' },
  'money-sm': { align: 'center', numeric: true, shrink: true, width: '9ch', maxWidth: '12ch' },
  'money-md': { align: 'center', numeric: true, shrink: true, width: '11ch', maxWidth: '14ch' },
  'money-lg': { align: 'center', numeric: true, shrink: true, width: '13ch', maxWidth: '17ch' },
  'serial-code': { align: 'center', shrink: true, width: '10ch', maxWidth: '18ch' },
  'code-sm': { align: 'center', shrink: true, width: '7ch', maxWidth: '9ch' },
  duration: { align: 'center', shrink: true, width: '8ch', maxWidth: '10ch' },
  count: { align: 'center', numeric: true, shrink: true, width: '5ch', maxWidth: '6ch' },
  tax: { align: 'center', numeric: true, shrink: true, width: '8ch', maxWidth: '9ch' },
};

export function inferColumnKind<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow>): ColumnKind {
  if (col.kind) return col.kind;
  if (col.key === 'actions') return 'actions';
  if (/amount|total|net|tax|balance|paid|remaining|salary|price|cost/i.test(col.key)) return 'money';
  if (col.numeric) return 'number';
  if (/date|at$|month|year/i.test(col.key)) return 'date';
  if (/status|kind|type/i.test(col.key)) return 'status';
  if (/number|id|ref|code/i.test(col.key)) return 'id';
  return 'text';
}

export function inferColumnSize<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow>): SmartTableColumnSize | undefined {
  if (col.size) return col.size;
  if (/^(tax|taxAmount|vat|vatAmount)$/i.test(col.key)) return 'tax';
  if (/^(net|netAmount|cost|acquisitionCost|price|unitPrice)$/i.test(col.key)) return 'money-sm';
  if (/^(total|totalAmount|amount)$/i.test(col.key)) return 'money-md';
  if (/^(name|nameAr|title|assetName)$/i.test(col.key)) return 'name';
  if (/supplier/i.test(col.key)) return 'supplier';
  if (/date|at$/i.test(col.key)) return 'date';
  if (/^(index|rowIndex|rowNumber|count|daysToWarrantyEnd)$/i.test(col.key)) return 'count';
  if (/^(serviceNumber)$/i.test(col.key)) return 'code-sm';
  if (/duration|months/i.test(col.key)) return 'duration';
  if (/serial/i.test(col.key)) return 'serial-code';
  if (/invoiceNumber|documentNumber|runNumber|orderNumber|batchId|ref|code/i.test(col.key)) return 'document';
  return undefined;
}

export function normalizeSmartColumn<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow>): SmartTableColumn<TRow> {
  const kind = inferColumnKind(col);
  const defaults = KIND_DEFAULTS[kind];
  const size = inferColumnSize(col);
  const sizeDefaults = size ? SIZE_DEFAULTS[size] : {};
  return {
    ...defaults,
    ...sizeDefaults,
    ...col,
    kind,
    size,
    numeric: col.numeric ?? sizeDefaults.numeric ?? defaults.numeric,
    align: col.align ?? sizeDefaults.align ?? defaults.align,
    shrink: col.shrink ?? sizeDefaults.shrink ?? defaults.shrink,
    width: col.width ?? sizeDefaults.width ?? defaults.width,
    minWidth: col.minWidth ?? sizeDefaults.minWidth ?? defaults.minWidth,
    maxWidth: col.maxWidth ?? sizeDefaults.maxWidth ?? defaults.maxWidth,
  };
}

export function getColumnKindClass<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow>): string {
  return `nx-col-kind-${inferColumnKind(col)}`;
}

export function getColumnTextAlign<TRow extends SmartTableRow = SmartTableRow>(col: SmartTableColumn<TRow>): CSSProperties['textAlign'] {
  const align = col.align || KIND_DEFAULTS[inferColumnKind(col)].align || 'start';
  if (align === 'start' || align === 'end' || align === 'left' || align === 'right' || align === 'center') {
    return align as CSSProperties['textAlign'];
  }
  return 'start';
}
