import type { CSSProperties } from 'react';
import type { SmartTableColumn } from './types';

type ColumnKind = NonNullable<SmartTableColumn['kind']>;

const KIND_DEFAULTS: Record<ColumnKind, Partial<SmartTableColumn>> = {
  id: { align: 'center', shrink: true, width: '10ch' },
  text: { align: 'start', minWidth: '14ch' },
  date: { align: 'center', shrink: true, width: '11ch' },
  money: { align: 'end', numeric: true, shrink: true, width: '12ch' },
  number: { align: 'end', numeric: true, shrink: true, width: '8ch' },
  status: { align: 'center', shrink: true, width: '9ch' },
  actions: { align: 'center', shrink: true, width: '48px' },
  meta: { align: 'center', shrink: true, width: '10ch' },
};

export function inferColumnKind(col: SmartTableColumn): ColumnKind {
  if (col.kind) return col.kind;
  if (col.key === 'actions') return 'actions';
  if (/amount|total|net|tax|balance|paid|remaining|salary|price|cost/i.test(col.key)) return 'money';
  if (col.numeric) return 'number';
  if (/date|at$|month|year/i.test(col.key)) return 'date';
  if (/status|kind|type/i.test(col.key)) return 'status';
  if (/number|id|ref|code/i.test(col.key)) return 'id';
  return 'text';
}

export function normalizeSmartColumn<TRow = any>(col: SmartTableColumn<TRow>): SmartTableColumn<TRow> {
  const kind = inferColumnKind(col);
  const defaults = KIND_DEFAULTS[kind];
  return {
    ...defaults,
    ...col,
    kind,
    numeric: col.numeric ?? defaults.numeric,
    align: col.align ?? defaults.align,
    shrink: col.shrink ?? defaults.shrink,
    width: col.width ?? defaults.width,
    minWidth: col.minWidth ?? defaults.minWidth,
    maxWidth: col.maxWidth ?? defaults.maxWidth,
  };
}

export function getColumnKindClass(col: SmartTableColumn): string {
  return `nx-col-kind-${inferColumnKind(col)}`;
}

export function getColumnTextAlign(col: SmartTableColumn): CSSProperties['textAlign'] {
  const align = col.align || KIND_DEFAULTS[inferColumnKind(col)].align || 'start';
  if (align === 'start' || align === 'end' || align === 'left' || align === 'right' || align === 'center') {
    return align as CSSProperties['textAlign'];
  }
  return 'start';
}
