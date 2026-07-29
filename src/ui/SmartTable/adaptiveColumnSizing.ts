import { isValidElement, type ReactNode } from 'react';
import type { SmartTableColumn, SmartTableColumnSize, SmartTableRow } from './types';
import { readRowValue } from './smartTableCellValue';

const CH_WIDTH_PX = 8;
const REM_WIDTH_PX = 16;
const DEFAULT_SAMPLE_SIZE = 40;

type WidthBounds = {
  min: number;
  max: number;
  fallback: number;
};

const SIZE_BOUNDS: Record<SmartTableColumnSize, WidthBounds> = {
  document: { min: 88, max: 190, fallback: 108 },
  name: { min: 150, max: 320, fallback: 190 },
  supplier: { min: 145, max: 300, fallback: 176 },
  date: { min: 92, max: 128, fallback: 104 },
  'money-sm': { min: 82, max: 140, fallback: 96 },
  'money-md': { min: 96, max: 160, fallback: 112 },
  'money-lg': { min: 112, max: 190, fallback: 136 },
  'serial-code': { min: 90, max: 180, fallback: 112 },
  'code-sm': { min: 64, max: 116, fallback: 76 },
  duration: { min: 76, max: 128, fallback: 92 },
  count: { min: 52, max: 88, fallback: 60 },
  tax: { min: 70, max: 116, fallback: 82 },
};

const KIND_BOUNDS: Record<NonNullable<SmartTableColumn['kind']>, WidthBounds> = {
  id: { min: 84, max: 180, fallback: 104 },
  text: { min: 132, max: 320, fallback: 160 },
  date: { min: 92, max: 128, fallback: 104 },
  money: { min: 92, max: 170, fallback: 112 },
  number: { min: 58, max: 110, fallback: 72 },
  status: { min: 76, max: 128, fallback: 92 },
  actions: { min: 44, max: 52, fallback: 44 },
  meta: { min: 76, max: 140, fallback: 96 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function cssLengthToPx(value: number | string | undefined): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith('%')) return undefined;
  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) return undefined;
  if (trimmed.endsWith('ch')) return numeric * CH_WIDTH_PX;
  if (trimmed.endsWith('rem')) return numeric * REM_WIDTH_PX;
  if (trimmed.endsWith('em')) return numeric * REM_WIDTH_PX;
  return numeric;
}

function boundsForColumn<TRow extends SmartTableRow>(col: SmartTableColumn<TRow>): WidthBounds {
  const defaults = col.size ? SIZE_BOUNDS[col.size] : KIND_BOUNDS[col.kind ?? 'text'];
  const explicitMin = cssLengthToPx(col.minWidth);
  const explicitMax = cssLengthToPx(col.maxWidth);
  const explicitWidth = cssLengthToPx(col.width);
  const min = Math.round(explicitMin ?? defaults.min);
  const max = Math.round(Math.max(explicitMax ?? defaults.max, min));
  const fallback = Math.round(clamp(explicitWidth ?? defaults.fallback, min, max));
  return { min, max, fallback };
}

function textFromReactNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromReactNode(node.props.children);
  return '';
}

function valueText(value: unknown): string {
  if (value == null || typeof value === 'boolean') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
  return '';
}

function estimateCharWidth<TRow extends SmartTableRow>(col: SmartTableColumn<TRow>): number {
  if (col.kind === 'money' || col.kind === 'number' || col.numeric) return 8.2;
  if (col.kind === 'date' || col.size === 'date') return 8;
  if (col.kind === 'id' || col.size === 'document' || col.size === 'serial-code') return 8.5;
  return 8.8;
}

export function estimateAdaptiveColumnWidth<TRow extends SmartTableRow>({
  col,
  rows,
  sampleSize = DEFAULT_SAMPLE_SIZE,
  label,
}: {
  col: SmartTableColumn<TRow>;
  rows: TRow[];
  sampleSize?: number;
  label: ReactNode;
}): number {
  const bounds = boundsForColumn(col);
  if (col.kind === 'actions') return bounds.fallback;

  const labelText = textFromReactNode(label);
  const maxRowChars = rows.slice(0, sampleSize).reduce((longest, row) => {
    const text = valueText(readRowValue(row, col.key));
    return Math.max(longest, text.length);
  }, 0);
  const maxChars = Math.max(labelText.length, maxRowChars);
  const padding = col.numeric ? 34 : 42;
  const estimated = Math.ceil(maxChars * estimateCharWidth(col) + padding);
  return Math.round(clamp(Math.max(estimated, bounds.fallback), bounds.min, bounds.max));
}

