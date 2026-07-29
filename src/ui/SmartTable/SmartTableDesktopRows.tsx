import React from 'react';
import { cn } from '../cn';
import { getAlign } from './columnUtils';
import { getColumnKindClass } from './columnPresets';
import { renderRawCellValue, readRowValue } from './smartTableCellValue';
import { buildBodyCellStyle, buildRowStyle } from './smartTableStyles';
import type { SmartTableColumn, SmartTableProps, SmartTableRow } from './types';
import type { SmartTableEngineRow } from './tableEngine';

type CurrencyElementProps = {
  className?: unknown;
  children?: React.ReactNode;
};

function hasCurrencyClass(className: unknown): boolean {
  if (typeof className === 'string') return className.split(/\s+/).includes('nx-sar');
  return false;
}

function stripTableCurrencySuffix(node: React.ReactNode): React.ReactNode {
  if (node == null || typeof node === 'boolean') return node;
  if (typeof node === 'string') return node.trim() === 'SR' ? '' : node.replace(/\s+SR$/u, '');
  if (typeof node === 'number' || typeof node === 'bigint') return node;
  if (Array.isArray(node)) return node.map(stripTableCurrencySuffix);
  if (!React.isValidElement<CurrencyElementProps>(node)) return node;

  if (hasCurrencyClass(node.props.className)) return null;
  if (node.props.children === undefined) return node;

  return React.cloneElement(node, undefined, stripTableCurrencySuffix(node.props.children));
}

type SmartTableDesktopRowsProps<TRow extends SmartTableRow> = {
  rows: SmartTableEngineRow<TRow>[];
  visibleColumns: SmartTableColumn<TRow>[];
  effectiveCols: number;
  emptyMsg: string;
  compact: boolean;
  layout: React.CSSProperties['tableLayout'];
  cellPad: { td: string; th: string };
  cellFs: number;
  showRowNumbers: boolean;
  rowNumberCellStyle: React.CSSProperties;
  paginationPage: number;
  safePageSize: number;
  stickyActionColumn: boolean;
  rowKey: (row: TRow, index: number) => React.Key;
  columnEffectiveWidth: (col: SmartTableColumn<TRow>) => number | string | undefined;
  getRowClassName?: SmartTableProps<TRow>['getRowClassName'];
  getRowStyle?: SmartTableProps<TRow>['getRowStyle'];
  isRowExpanded?: SmartTableProps<TRow>['isRowExpanded'];
  renderExpandedRow?: SmartTableProps<TRow>['renderExpandedRow'];
};

export function SmartTableDesktopRows<TRow extends SmartTableRow>({
  rows,
  visibleColumns,
  effectiveCols,
  emptyMsg,
  compact,
  layout,
  cellPad,
  cellFs,
  showRowNumbers,
  rowNumberCellStyle,
  paginationPage,
  safePageSize,
  stickyActionColumn,
  rowKey,
  columnEffectiveWidth,
  getRowClassName,
  getRowStyle,
  isRowExpanded,
  renderExpandedRow,
}: SmartTableDesktopRowsProps<TRow>) {
  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={effectiveCols}
          className={cn(
            'text-center text-noorix-muted',
            compact ? 'px-4 py-6 text-[13px]' : 'p-9 text-[15px]',
          )}
        >
          {emptyMsg}
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map(({ original: row, index: i }) => (
        <React.Fragment key={rowKey(row, i)}>
          <tr
            className={`nx-smart-row-vars border-b border-noorix-border${typeof getRowClassName === 'function' && getRowClassName(row, i) ? ` ${getRowClassName(row, i)}` : ''}`}
            style={buildRowStyle({ row, index: i, getRowStyle })}
          >
            {showRowNumbers && (
              <td className="nx-row-number-td nx-smart-row-number-cell nx-smart-body-cell-vars text-center font-semibold" style={rowNumberCellStyle}>
                {(paginationPage - 1) * safePageSize + i + 1}
              </td>
            )}
            {visibleColumns.map((col) => {
              const value = readRowValue(row, col.key);
              const align = getAlign(col);
              const family = col.numeric ? 'var(--noorix-font-numbers)' : undefined;
              const shrink = col.shrink === true;
              const actionSticky = col.key === 'actions' && stickyActionColumn;
              const shouldTruncate = !col.numeric && col.key !== 'actions' && !shrink && (layout === 'fixed' || !!col.maxWidth);
              const tdEffectiveWidth = columnEffectiveWidth(col);
              const renderedValue = stripTableCurrencySuffix(col.render ? col.render(value, row, i) : renderRawCellValue(value));
              return (
                <td
                  key={col.key}
                  className={cn(
                    'nx-smart-body-cell-vars',
                    col.cellClassName,
                    getColumnKindClass(col),
                    col.key === 'actions' ? `noorix-actions-cell${actionSticky ? ` noorix-actions-sticky${compact ? ' noorix-actions-compact' : ''}` : (compact ? ' noorix-actions-compact' : '')}` : '',
                    col.numeric ? 'noorix-numeric-cell' : '',
                    shrink ? 'noorix-td-shrink' : '',
                    shouldTruncate ? 'noorix-table-cell-truncate' : '',
                  )}
                  style={buildBodyCellStyle({
                    col,
                    tdEffectiveWidth,
                    align: align as React.CSSProperties['textAlign'],
                    family,
                    shrink,
                    cellPad,
                    cellFs,
                  })}
                  data-column-kind={col.kind}
                  data-column-size={col.size}
                >
                  {col.numeric ? (
                    <div className="nx-smart-numeric-content">{renderedValue}</div>
                  ) : renderedValue}
                </td>
              );
            })}
          </tr>
          {typeof renderExpandedRow === 'function' && isRowExpanded?.(row, i) && (
            <tr className="border-b border-noorix-border bg-noorix-surface">
              <td colSpan={effectiveCols} className="p-0">
                {renderExpandedRow(row, i)}
              </td>
            </tr>
          )}
        </React.Fragment>
      ))}
    </>
  );
}
