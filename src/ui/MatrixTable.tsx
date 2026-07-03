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

export type MatrixTableRowTone = 'default' | 'group' | 'summary' | 'total' | 'muted';

export type MatrixTableProps<TRow = any> = {
  columns: MatrixTableColumn<TRow>[];
  data?: TRow[];
  caption?: React.ReactNode;
  ariaLabel?: string;
  emptyMessage?: React.ReactNode;
  tableMinWidth?: React.CSSProperties['minWidth'];
  maxHeight?: React.CSSProperties['maxHeight'];
  fixedFirstColumn?: boolean;
  firstColumnAsHeader?: boolean;
  stickyHeader?: boolean;
  frameClassName?: string;
  tableClassName?: string;
  scrollClassName?: string;
  footer?: React.ReactNode;
  getRowKey?: (row: TRow, rowIndex: number) => React.Key;
  getRowTone?: (row: TRow, rowIndex: number) => MatrixTableRowTone | undefined;
  getRowClassName?: (row: TRow, rowIndex: number) => string | undefined;
  getRowStyle?: (row: TRow, rowIndex: number) => React.CSSProperties | undefined;
  getRowAccentColor?: (row: TRow, rowIndex: number) => string | undefined;
};

const MATRIX_ROW_TONE_CLASSES: Record<MatrixTableRowTone, string> = {
  default: '',
  group: 'bg-noorix-bg-muted/70 font-bold',
  summary: 'bg-noorix-bg-muted/40 font-semibold',
  total: 'bg-noorix-bg-muted font-bold',
  muted: 'text-noorix-muted',
};

export default function MatrixTable<TRow extends Record<string, any> = any>({
  columns,
  data = [],
  caption,
  ariaLabel,
  emptyMessage = '-',
  tableMinWidth = 0,
  maxHeight,
  fixedFirstColumn = true,
  firstColumnAsHeader = false,
  stickyHeader = false,
  frameClassName = '',
  tableClassName = '',
  scrollClassName = '',
  footer,
  getRowKey,
  getRowTone,
  getRowClassName,
  getRowStyle,
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
          aria-label={ariaLabel}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
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
                      ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: firstColumn ? 4 : 3 } : null),
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
              data.map((row, rowIndex) => {
                const rowTone = getRowTone?.(row, rowIndex) ?? 'default';
                return (
                  <tr
                    key={getRowKey?.(row, rowIndex) ?? row.id ?? row.key ?? rowIndex}
                    className={cn(
                      'transition-colors',
                      MATRIX_ROW_TONE_CLASSES[rowTone],
                      getRowClassName?.(row, rowIndex),
                    )}
                    style={getRowStyle?.(row, rowIndex)}
                  >
                    {columns.map((col, columnIndex) => {
                      const firstColumn = fixedFirstColumn && columnIndex === 0;
                      const useRowHeader = firstColumnAsHeader && columnIndex === 0;
                      const CellTag = useRowHeader ? 'th' : 'td';
                      const accentColor = firstColumn ? getRowAccentColor?.(row, rowIndex) : undefined;
                      const cellClassName =
                        typeof col.cellClassName === 'function'
                          ? col.cellClassName(row, rowIndex)
                          : col.cellClassName;

                      return (
                        <CellTag
                          key={col.key}
                          scope={useRowHeader ? 'row' : undefined}
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
                        </CellTag>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  );
}
