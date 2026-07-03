export type PrintTableAlign = 'start' | 'center' | 'end' | 'left' | 'right';

export type PrintTableColumn<Row = unknown> = {
  key: string | number;
  header: unknown;
  align?: PrintTableAlign;
  headerClassName?: string;
  cellClassName?: string | ((value: unknown, row: Row, rowIndex: number) => string);
  format?: (value: unknown, row: Row, rowIndex: number) => unknown;
};

export type PrintTableRowMeta<Row = unknown> = {
  className?: string | ((row: Row, rowIndex: number) => string);
};

export type PrintTableFooterCell = {
  value: unknown;
  colSpan?: number;
  align?: PrintTableAlign;
  className?: string;
};

export type BuildPrintTableHtmlOptions<Row = unknown> = {
  columns: PrintTableColumn<Row>[];
  rows?: Row[];
  tableClassName?: string;
  wrapperClassName?: string;
  emptyMessage?: string;
  rowMetas?: PrintTableRowMeta<Row>[];
  footerRows?: PrintTableFooterCell[][];
};

const ALIGN_CLASS: Record<PrintTableAlign, string> = {
  start: 'print-table__cell--start',
  center: 'print-table__cell--center',
  end: 'print-table__cell--end',
  left: 'print-table__cell--left',
  right: 'print-table__cell--right',
};

export function escapePrintHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizePrintClassName(value: unknown): string {
  return String(value ?? '')
    .split(/\s+/)
    .filter((item) => /^[a-zA-Z0-9_-]+$/.test(item))
    .join(' ');
}

function classAttr(...values: unknown[]): string {
  const className = sanitizePrintClassName(values.filter(Boolean).join(' '));
  return className ? ` class="${escapePrintHtml(className)}"` : '';
}

function colSpanAttr(value: unknown): string {
  const colSpan = Number(value);
  return Number.isInteger(colSpan) && colSpan > 1 ? ` colspan="${colSpan}"` : '';
}

function getRowValue<Row>(row: Row, key: string | number): unknown {
  if (Array.isArray(row)) return row[Number(key)];
  if (row && typeof row === 'object') return (row as Record<string, unknown>)[String(key)];
  return undefined;
}

function resolveCellClass<Row>(
  cellClassName: PrintTableColumn<Row>['cellClassName'],
  value: unknown,
  row: Row,
  rowIndex: number,
): string {
  return typeof cellClassName === 'function' ? cellClassName(value, row, rowIndex) : cellClassName ?? '';
}

function resolveRowClass<Row>(meta: PrintTableRowMeta<Row> | undefined, row: Row, rowIndex: number): string {
  if (!meta?.className) return '';
  return typeof meta.className === 'function' ? meta.className(row, rowIndex) : meta.className;
}

export function buildPrintTableHtml<Row = unknown>({
  columns,
  rows = [],
  tableClassName = 'print-table',
  wrapperClassName = 'print-table-wrap',
  emptyMessage = 'No data',
  rowMetas = [],
  footerRows = [],
}: BuildPrintTableHtmlOptions<Row>): string {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const colCount = Math.max(safeColumns.length, 1);

  const headRow = `<tr>${safeColumns
    .map((column) => {
      const alignClass = column.align ? ALIGN_CLASS[column.align] : '';
      return `<th${classAttr(alignClass, column.headerClassName)}>${escapePrintHtml(column.header)}</th>`;
    })
    .join('')}</tr>`;

  const bodyRows = rows.length
    ? rows
        .map((row, rowIndex) => {
          const rowClass = resolveRowClass(rowMetas[rowIndex], row, rowIndex);
          const cells = safeColumns
            .map((column) => {
              const rawValue = getRowValue(row, column.key);
              const value = column.format ? column.format(rawValue, row, rowIndex) : rawValue;
              const alignClass = column.align ? ALIGN_CLASS[column.align] : '';
              const cellClass = resolveCellClass(column.cellClassName, rawValue, row, rowIndex);
              return `<td${classAttr(alignClass, cellClass)}>${escapePrintHtml(value)}</td>`;
            })
            .join('');
          return `<tr${classAttr(rowClass)}>${cells}</tr>`;
        })
        .join('')
    : `<tr class="print-table__empty-row"><td class="print-table__empty-cell" colspan="${colCount}">${escapePrintHtml(emptyMessage)}</td></tr>`;

  const footRows = footerRows.length
    ? `<tfoot>${footerRows
        .map((row) => {
          const cells = row
            .map((cell) => {
              const alignClass = cell.align ? ALIGN_CLASS[cell.align] : '';
              return `<td${classAttr(alignClass, cell.className)}${colSpanAttr(cell.colSpan)}>${escapePrintHtml(cell.value)}</td>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('')}</tfoot>`
    : '';

  return `<div${classAttr(wrapperClassName)}><table${classAttr(tableClassName)}><thead>${headRow}</thead><tbody>${bodyRows}</tbody>${footRows}</table></div>`;
}
