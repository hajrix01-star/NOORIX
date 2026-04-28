import type { ReactNode } from 'react';
import type { SmartTableColumn } from './types';

const ALIGN_MAP: Record<string, string> = { right: 'right', left: 'left', center: 'center', start: 'start', end: 'end' };

export function columnLabel(col: SmartTableColumn | null | undefined): ReactNode {
  if (col == null) return '';
  return col.label ?? col.header ?? '';
}

export function getAlign(col: SmartTableColumn | null | undefined) {
  if (col?.align) return (ALIGN_MAP as Record<string, string>)[String(col.align)] || 'start';
  if (col?.numeric) return 'right';
  return 'start';
}
