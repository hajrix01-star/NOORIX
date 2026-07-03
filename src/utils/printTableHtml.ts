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
  rowSpan?: number;
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
  showHeader?: boolean;
};

export type BuildPrintRecordsTableHtmlOptions<Row extends Record<string, unknown> = Record<string, unknown>> =
  Omit<BuildPrintTableHtmlOptions<Row>, 'columns' | 'rows'> & {
    records?: Row[];
    columnKeys?: string[];
    columnLabels?: Record<string, unknown>;
    numericKeys?: string[];
  };

export type BuildPrintDefinitionTableHtmlOptions = Omit<
  BuildPrintTableHtmlOptions<{ label: unknown; value: unknown }>,
  'columns' | 'rows'
> & {
  entries?: Array<{ label: unknown; value: unknown }>;
};

export type PrintHtmlTableCell = {
  value?: unknown;
  html?: string;
  colSpan?: number;
  rowSpan?: number;
  align?: PrintTableAlign;
  className?: string;
  style?: string;
};

export type PrintHtmlTableRow = {
  className?: string;
  cells: PrintHtmlTableCell[];
};

export type BuildPrintHtmlTableOptions = {
  headerRows?: PrintHtmlTableRow[];
  bodyRows?: PrintHtmlTableRow[];
  footerRows?: PrintHtmlTableRow[];
  tableClassName?: string;
  wrapperClassName?: string | null;
  emptyMessage?: string;
  emptyColSpan?: number;
};

const ALIGN_CLASS: Record<PrintTableAlign, string> = {
  start: 'print-table__cell--start',
  center: 'print-table__cell--center',
  end: 'print-table__cell--end',
  left: 'print-table__cell--left',
  right: 'print-table__cell--right',
};

const MAX_PRINT_TABLE_SPAN = 100;
const SAFE_PRINT_STYLE_PROPERTIES = new Set([
  'background',
  'background-color',
  'border',
  'border-radius',
  'color',
  'direction',
  'font-size',
  'font-weight',
  'height',
  'line-height',
  'margin',
  'max-width',
  'min-width',
  'padding',
  'text-align',
  'unicode-bidi',
  'vertical-align',
  'width',
]);
const UNSAFE_PRINT_STYLE_VALUE = /(?:url\s*\(|expression\s*\(|javascript:|[<>{}])/i;

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
  return Number.isInteger(colSpan) && colSpan > 1 && colSpan <= MAX_PRINT_TABLE_SPAN ? ` colspan="${colSpan}"` : '';
}

function rowSpanAttr(value: unknown): string {
  const rowSpan = Number(value);
  return Number.isInteger(rowSpan) && rowSpan > 1 && rowSpan <= MAX_PRINT_TABLE_SPAN ? ` rowspan="${rowSpan}"` : '';
}

function sanitizePrintStyle(value: unknown): string {
  return String(value ?? '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex <= 0) return '';
      const property = declaration.slice(0, colonIndex).trim().toLowerCase();
      const propertyValue = declaration.slice(colonIndex + 1).trim();
      if (!SAFE_PRINT_STYLE_PROPERTIES.has(property)) return '';
      if (!propertyValue || UNSAFE_PRINT_STYLE_VALUE.test(propertyValue)) return '';
      return `${property}:${propertyValue}`;
    })
    .filter(Boolean)
    .join(';');
}

function styleAttr(value: unknown): string {
  const style = sanitizePrintStyle(value);
  return style ? ` style="${escapePrintHtml(style)}"` : '';
}

function renderPrintHtmlTableCell(cell: PrintHtmlTableCell, tagName: 'td' | 'th'): string {
  const alignClass = cell.align ? ALIGN_CLASS[cell.align] : '';
  const content = cell.html != null ? String(cell.html) : escapePrintHtml(cell.value);
  return `<${tagName}${classAttr(alignClass, cell.className)}${colSpanAttr(cell.colSpan)}${rowSpanAttr(cell.rowSpan)}${styleAttr(cell.style)}>${content}</${tagName}>`;
}

function renderPrintHtmlTableRows(rows: PrintHtmlTableRow[], tagName: 'td' | 'th'): string {
  return rows
    .map((row) => `<tr${classAttr(row.className)}>${row.cells.map((cell) => renderPrintHtmlTableCell(cell, tagName)).join('')}</tr>`)
    .join('');
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
  showHeader = true,
}: BuildPrintTableHtmlOptions<Row>): string {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const colCount = Math.max(safeColumns.length, 1);

  const headRows = showHeader
    ? `<thead><tr>${safeColumns
        .map((column) => {
          const alignClass = column.align ? ALIGN_CLASS[column.align] : '';
          return `<th${classAttr(alignClass, column.headerClassName)}>${escapePrintHtml(column.header)}</th>`;
        })
        .join('')}</tr></thead>`
    : '';

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
              return `<td${classAttr(alignClass, cell.className)}${colSpanAttr(cell.colSpan)}${rowSpanAttr(cell.rowSpan)}>${escapePrintHtml(cell.value)}</td>`;
            })
            .join('');
          return `<tr>${cells}</tr>`;
        })
        .join('')}</tfoot>`
    : '';

  return `<div${classAttr(wrapperClassName)}><table${classAttr(tableClassName)}>${headRows}<tbody>${bodyRows}</tbody>${footRows}</table></div>`;
}

export function buildPrintRecordsTableHtml<Row extends Record<string, unknown> = Record<string, unknown>>({
  records = [],
  columnKeys,
  columnLabels = {},
  numericKeys = [],
  ...rest
}: BuildPrintRecordsTableHtmlOptions<Row>): string {
  const keys = columnKeys?.length ? columnKeys : records[0] ? Object.keys(records[0]) : [];
  const numericKeySet = new Set(numericKeys);
  return buildPrintTableHtml<Row>({
    ...rest,
    columns: keys.map((key) => ({
      key,
      header: columnLabels[key] ?? key,
      align: numericKeySet.has(key) ? 'end' : undefined,
    })),
    rows: records,
  });
}

export function buildPrintDefinitionTableHtml({
  entries = [],
  tableClassName,
  wrapperClassName,
  emptyMessage,
  rowMetas,
  footerRows,
}: BuildPrintDefinitionTableHtmlOptions): string {
  return buildPrintTableHtml({
    columns: [
      { key: 'label', header: '', cellClassName: 'print-table__definition-label' },
      { key: 'value', header: '', cellClassName: 'print-table__definition-value' },
    ],
    rows: entries,
    tableClassName,
    wrapperClassName,
    emptyMessage,
    rowMetas,
    footerRows,
    showHeader: false,
  });
}

export function buildPrintHtmlTable({
  headerRows = [],
  bodyRows = [],
  footerRows = [],
  tableClassName = 'print-table',
  wrapperClassName = 'print-table-wrap',
  emptyMessage = 'No data',
  emptyColSpan,
}: BuildPrintHtmlTableOptions): string {
  const headerHtml = headerRows.length ? `<thead>${renderPrintHtmlTableRows(headerRows, 'th')}</thead>` : '';
  const colCount = Math.max(
    emptyColSpan ?? 0,
    ...headerRows.flatMap((row) => row.cells.map((cell) => Number(cell.colSpan) || 1)),
    ...bodyRows.flatMap((row) => row.cells.map((cell) => Number(cell.colSpan) || 1)),
    1,
  );
  const bodyHtml = bodyRows.length
    ? renderPrintHtmlTableRows(bodyRows, 'td')
    : `<tr class="print-table__empty-row"><td class="print-table__empty-cell" colspan="${colCount}">${escapePrintHtml(emptyMessage)}</td></tr>`;
  const footerHtml = footerRows.length ? `<tfoot>${renderPrintHtmlTableRows(footerRows, 'td')}</tfoot>` : '';
  const tableHtml = `<table${classAttr(tableClassName)}>${headerHtml}<tbody>${bodyHtml}</tbody>${footerHtml}</table>`;

  return wrapperClassName === null ? tableHtml : `<div${classAttr(wrapperClassName)}>${tableHtml}</div>`;
}
