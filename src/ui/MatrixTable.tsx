import React from 'react';
import { cn } from './cn';

export type MatrixTableColumn<TRow = any> = {
  key: string;
  label?: React.ReactNode;
  width?: React.CSSProperties['width'];
  minWidth?: React.CSSProperties['minWidth'];
  align?: React.CSSProperties['textAlign'];
  numeric?: boolean;
  headerClassName?: string;
  cellClassName?: string | ((row: TRow, rowIndex: number) => string | undefined);
  render?: (value: unknown, row: TRow, rowIndex: number) => React.ReactNode;
  getCellStyle?: (row: TRow, rowIndex: number) => React.CSSProperties | undefined;
};

export type MatrixTableProps<TRow = any> = {
  columns: MatrixTableColumn<TRow>[];
  data?: TRow[];
  emptyMessage?: React.ReactNode;
  tableMinWidth?: React.CSSProperties['minWidth'];
  maxHeight?: React.CSSProperties['maxHeight'];
  fixedFirstColumn?: boolean;
  frameClassName?: string;
  tableClassName?: string;
  scrollClassName?: string;
  footer?: React.ReactNode;
  getRowKey?: (row: TRow, rowIndex: number) => React.Key;
  getRowClassName?: (row: TRow, rowIndex: number) => string | undefined;
  getRowAccentColor?: (row: TRow, rowIndex: number) => string | undefined;
};

export default function MatrixTable<TRow extends Record<string, any> = any>({
  columns,
  data = [],
  emptyMessage = '-',
  tableMinWidth = 0,
  maxHeight,
  fixedFirstColumn = true,
  frameClassName = '',
  tableClassName = '',
  scrollClassName = '',
  footer,
  getRowKey,
  getRowClassName,
  getRowAccentColor,
}: MatrixTableProps<TRow>) {
  return (
    <div className={cn('noorix-table-frame min-w-0 max-w-full', frameClassName)}>
      <div
        className={cn('noorix-table-scroll-wrapper', scrollClassName)}
        style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined }}
      >
        <table
          className={cn('noorix-table w-full border-collapse', tableClassName)}
          style={{ minWidth: tableMinWidth || undefined }}
        >
          <thead>
            <tr>
              {columns.map((col, columnIndex) => {
                const firstColumn = fixedFirstColumn && columnIndex === 0;
                return (
                  <th
                    key={col.key}
                    className={cn(
                      firstColumn && 'sticky start-0 z-[3]',
                      col.headerClassName,
                    )}
                    style={{
                      width: col.width,
                      minWidth: col.minWidth,
                      textAlign: col.align || (col.numeric ? 'end' : 'center'),
                    }}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length || 1} className="p-[24px_16px] text-center text-noorix-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={getRowKey?.(row, rowIndex) ?? row.id ?? row.key ?? rowIndex}
                  className={cn('transition-colors', getRowClassName?.(row, rowIndex))}
                >
                  {columns.map((col, columnIndex) => {
                    const firstColumn = fixedFirstColumn && columnIndex === 0;
                    const accentColor = firstColumn ? getRowAccentColor?.(row, rowIndex) : undefined;
                    const cellClassName =
                      typeof col.cellClassName === 'function'
                        ? col.cellClassName(row, rowIndex)
                        : col.cellClassName;

                    return (
                      <td
                        key={col.key}
                        className={cn(
                          col.numeric && 'noorix-numeric-cell tabular-nums',
                          firstColumn && 'sticky start-0 z-[1]',
                          cellClassName,
                        )}
                        data-numeric={col.numeric ? 'true' : undefined}
                        style={{
                          width: col.width,
                          minWidth: col.minWidth,
                          textAlign: col.align || (col.numeric ? 'end' : undefined),
                          ...col.getCellStyle?.(row, rowIndex),
                        }}
                      >
                        {firstColumn && accentColor ? (
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm"
                              style={{ background: accentColor }}
                            />
                            <span className="min-w-0">
                              {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                            </span>
                          </span>
                        ) : (
                          col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]
                        )}
                      </td>
                    );
                  })}
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
