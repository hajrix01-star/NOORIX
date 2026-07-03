import React from 'react';
import { cn } from './cn';

type TableCssVars = React.CSSProperties & Record<`--${string}`, string | number | undefined>;

function cssLength(value: React.CSSProperties['width'] | undefined): string | number | undefined {
  if (value == null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export type SimpleTableColumn<TRow = any> = {
  key: string;
  label?: React.ReactNode;
  width?: React.CSSProperties['width'];
  minWidth?: React.CSSProperties['minWidth'];
  align?: React.CSSProperties['textAlign'];
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string;
  render?: (value: unknown, row: TRow, index: number) => React.ReactNode;
};

export type SimpleTableProps<TRow = any> = {
  columns: SimpleTableColumn<TRow>[];
  data?: TRow[];
  emptyMessage?: React.ReactNode;
  tableMinWidth?: React.CSSProperties['minWidth'];
  maxHeight?: React.CSSProperties['maxHeight'];
  compact?: boolean;
  cellPadding?: React.CSSProperties['padding'];
  stickyHeader?: boolean;
  frameClassName?: string;
  tableClassName?: string;
  footer?: React.ReactNode;
  getRowClassName?: (row: TRow, index: number) => string | undefined;
  getRowStyle?: (row: TRow, index: number) => React.CSSProperties | undefined;
  onRowClick?: (row: TRow, index: number) => void;
};

export default function SimpleTable<TRow extends Record<string, any> = any>({
  columns,
  data = [],
  emptyMessage = '-',
  tableMinWidth = 0,
  maxHeight,
  compact = true,
  cellPadding,
  stickyHeader = false,
  frameClassName = '',
  tableClassName = '',
  footer,
  getRowClassName,
  getRowStyle,
  onRowClick,
}: SimpleTableProps<TRow>) {
  const resolvedCellPadding = cellPadding ?? (compact ? '6px 12px' : '8px 14px');
  const scrollStyle: TableCssVars | undefined = maxHeight
    ? {
        '--nx-dg-scroll-max-height': cssLength(maxHeight),
        '--nx-dg-scroll-overflow-y': 'auto',
      }
    : undefined;
  const tableStyle: TableCssVars | undefined = tableMinWidth
    ? { '--nx-dg-min-width': cssLength(tableMinWidth) }
    : undefined;
  const headerStyle = (col: SimpleTableColumn<TRow>): TableCssVars => ({
    '--nx-dg-cell-width': cssLength(col.width),
    '--nx-dg-cell-min-width': cssLength(col.minWidth),
    '--nx-dg-cell-padding': resolvedCellPadding,
    '--nx-dg-cell-align': col.align || (col.numeric ? 'end' : 'center'),
  });
  const cellStyle = (col: SimpleTableColumn<TRow>): TableCssVars => ({
    '--nx-dg-cell-width': cssLength(col.width),
    '--nx-dg-cell-min-width': cssLength(col.minWidth),
    '--nx-dg-cell-padding': resolvedCellPadding,
    '--nx-dg-cell-align': col.align || (col.numeric ? 'end' : undefined),
  });

  return (
    <div className={cn('noorix-table-frame min-w-0 max-w-full', frameClassName)}>
      <div
        className="noorix-table-scroll-wrapper nx-dg-scroll-vars"
        style={scrollStyle}
      >
        <table
          className={cn('noorix-table nx-dg-vars w-full', tableClassName)}
          style={tableStyle}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('nx-dg-var-cell', stickyHeader && 'nx-dg-var-th--sticky', col.headerClassName)}
                  style={headerStyle(col)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1} className={cn('text-center text-noorix-muted', compact ? 'p-[24px_16px]' : 'p-9')}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? row.key ?? rowIndex}
                  className={getRowClassName?.(row, rowIndex)}
                  style={getRowStyle?.(row, rowIndex)}
                  onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row, rowIndex);
                    }
                  } : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('nx-dg-var-cell', col.numeric && 'noorix-numeric-cell', col.cellClassName)}
                      data-numeric={col.numeric ? 'true' : undefined}
                      style={cellStyle(col)}
                    >
                      {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
