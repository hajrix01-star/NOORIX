import React from 'react';
import { cn } from './cn';

export type SimpleTableColumn<TRow = any> = {
  key: string;
  label?: React.ReactNode;
  width?: React.CSSProperties['width'];
  minWidth?: React.CSSProperties['minWidth'];
  align?: React.CSSProperties['textAlign'];
  numeric?: boolean;
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
  stickyHeader?: boolean;
  frameClassName?: string;
  tableClassName?: string;
  footer?: React.ReactNode;
  getRowClassName?: (row: TRow, index: number) => string | undefined;
  getRowStyle?: (row: TRow, index: number) => React.CSSProperties | undefined;
};

export default function SimpleTable<TRow extends Record<string, any> = any>({
  columns,
  data = [],
  emptyMessage = '-',
  tableMinWidth = 0,
  maxHeight,
  compact = true,
  stickyHeader = false,
  frameClassName = '',
  tableClassName = '',
  footer,
  getRowClassName,
  getRowStyle,
}: SimpleTableProps<TRow>) {
  const cellPadding = compact ? '6px 12px' : '8px 14px';

  return (
    <div className={cn('noorix-table-frame min-w-0 max-w-full', frameClassName)}>
      <div
        className="noorix-table-scroll-wrapper"
        style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined }}
      >
        <table
          className={cn('noorix-table w-full', tableClassName)}
          style={{ minWidth: tableMinWidth || undefined }}
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                    padding: cellPadding,
                    textAlign: col.align || (col.numeric ? 'end' : 'center'),
                    ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 2 } : null),
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1} className="text-center text-noorix-muted" style={{ padding: compact ? '24px 16px' : '36px' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? row.key ?? rowIndex}
                  className={getRowClassName?.(row, rowIndex)}
                  style={getRowStyle?.(row, rowIndex)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(col.numeric && 'noorix-numeric-cell', col.cellClassName)}
                      data-numeric={col.numeric ? 'true' : undefined}
                      style={{
                        width: col.width,
                        minWidth: col.minWidth,
                        padding: cellPadding,
                        textAlign: col.align || (col.numeric ? 'end' : undefined),
                      }}
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
