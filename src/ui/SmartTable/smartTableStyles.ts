import type React from 'react';
import type { SmartTableProps } from './types';

export const DEFAULT_INNER_PADDING = 8;
export const DEFAULT_ROW_NUMBER_WIDTH = 40;

export type SmartTableCssVars = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

export function normalizeRowNumberWidth(width: SmartTableProps['rowNumberWidth']): number | string {
  if (width == null || width === '') return DEFAULT_ROW_NUMBER_WIDTH;
  if (typeof width === 'string' && width.trim().endsWith('%')) return DEFAULT_ROW_NUMBER_WIDTH;
  return width;
}

export function cssLength(value: number | string | undefined): string | undefined {
  if (value == null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export function buildFrameStyle(innerPadding: number | string | undefined): SmartTableCssVars {
  return { '--nx-smart-frame-padding': cssLength(innerPadding) };
}

export function buildTableStyle({
  layout,
  minW,
  isWideTable,
}: {
  layout: string;
  minW: number | string | undefined;
  isWideTable: boolean;
}): SmartTableCssVars {
  return {
    '--nx-smart-table-layout': layout,
    '--nx-smart-table-min-width': cssLength(minW),
    '--nx-smart-table-max-width': !isWideTable ? '100%' : undefined,
  };
}

export function buildRowNumberHeaderStyle({
  cellPad,
  compact,
  rowNumW,
}: {
  cellPad: { th: string; td: string };
  compact: boolean;
  rowNumW: number | string;
}): SmartTableCssVars {
  return {
    '--nx-smart-cell-padding': cellPad.th,
    '--nx-smart-cell-font-size': cssLength(compact ? 11 : 12),
    '--nx-smart-row-number-width': cssLength(rowNumW),
  };
}

export function buildRowNumberCellStyle({
  cellPad,
  cellFs,
  rowNumW,
}: {
  cellPad: { th: string; td: string };
  cellFs: number;
  rowNumW: number | string;
}): SmartTableCssVars {
  return {
    '--nx-smart-cell-padding': cellPad.td,
    '--nx-smart-cell-font-size': cssLength(cellFs),
    '--nx-smart-row-number-width': cssLength(rowNumW),
  };
}

export function buildHeaderCellStyle({
  col,
  effectiveWidth,
  resizableCol,
  shrink,
  cellPad,
  compact,
}: {
  col: any;
  effectiveWidth: any;
  resizableCol: boolean;
  shrink: boolean;
  cellPad: { th: string; td: string };
  compact: boolean;
}): SmartTableCssVars {
  return {
    '--nx-smart-cell-padding': cellPad.th,
    '--nx-smart-cell-font-size': cssLength(compact ? 12 : 13),
    '--nx-smart-cell-position': resizableCol ? 'relative' : undefined,
    '--nx-smart-cell-width': cssLength(effectiveWidth),
    '--nx-smart-cell-min-width': cssLength(col.minWidth),
    '--nx-smart-cell-max-width': resizableCol ? undefined : cssLength(col.maxWidth),
    '--nx-smart-cell-cursor': col.sortable ? 'pointer' : 'default',
    '--nx-smart-cell-user-select': col.sortable ? 'none' : 'auto',
    '--nx-smart-cell-white-space': shrink || col.key === 'actions' ? 'nowrap' : 'normal',
    '--nx-smart-cell-overflow': resizableCol ? 'hidden' : undefined,
  };
}

export function buildBodyCellStyle({
  col,
  tdEffectiveWidth,
  align,
  family,
  shrink,
  cellPad,
  cellFs,
}: {
  col: any;
  tdEffectiveWidth: any;
  align: React.CSSProperties['textAlign'];
  family: string | undefined;
  shrink: boolean;
  cellPad: { th: string; td: string };
  cellFs: number;
}): SmartTableCssVars {
  return {
    '--nx-smart-cell-padding': cellPad.td,
    '--nx-smart-cell-font-size': cssLength(cellFs),
    '--nx-smart-cell-align': align,
    '--nx-smart-cell-font-family': family,
    '--nx-smart-cell-width': cssLength(tdEffectiveWidth),
    '--nx-smart-cell-min-width': cssLength(col.minWidth),
    '--nx-smart-cell-max-width': cssLength(col.maxWidth),
    '--nx-smart-cell-white-space': shrink ? 'nowrap' : undefined,
  };
}

export function buildRowStyle({
  row,
  index,
  getRowStyle,
}: {
  row: any;
  index: number;
  getRowStyle?: SmartTableProps['getRowStyle'];
}): SmartTableCssVars {
  return {
    '--nx-smart-row-bg': index % 2 === 1 ? 'var(--noorix-bg-page)' : 'transparent',
    ...(typeof getRowStyle === 'function' ? getRowStyle(row, index) : null),
  };
}
