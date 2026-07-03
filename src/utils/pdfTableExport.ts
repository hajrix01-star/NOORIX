import { normalizeColumnDefs } from './exportNormalize';
import { buildPrintTableHtml, type PrintTableColumn, type PrintTableRowMeta } from './printTableHtml';
import { openPrintWindow } from './printUtils';

export type ProfitLossPdfRowMeta = {
  rowType?: string;
  groupKey?: string | null;
  tone?: 'pos' | 'neg' | 'neutral';
  key?: string;
};

type ExportTableToPdfOpts = {
  columns?: unknown;
  data?: unknown[];
  title?: string;
  companyName?: string;
  subtitle?: string;
  filename?: string;
  landscape?: boolean;
  logoUrl?: string;
  extraCss?: string;
  htmlDir?: 'rtl' | 'ltr';
  htmlLang?: string;
  tableClass?: string;
  showPageCounter?: boolean;
  pageMarginMm?: number;
  pdfRowMetas?: ProfitLossPdfRowMeta[];
};

function buildPlPdfTrClass(meta: ProfitLossPdfRowMeta | undefined): string {
  if (!meta || !meta.rowType) return '';
  const gk = String(meta.groupKey || '').replace(/[^a-z0-9_-]/gi, '');
  let cls = `pl-pdf-tr pl-pdf-row-${meta.rowType}`;
  if (meta.rowType === 'group' && gk) cls += ` pl-pdf-gk-${gk}`;
  if (meta.rowType === 'summary') {
    if (meta.tone === 'pos') cls += ' pl-pdf-net-positive';
    else if (meta.tone === 'neg') cls += ' pl-pdf-net-negative';
  }
  return cls;
}

function buildPrintTableColumns(labels: unknown[], keys: unknown[]): PrintTableColumn[] {
  return labels.map((label, index) => ({
    key: String(keys[index] ?? index),
    header: label,
  }));
}

export function exportTableToPdf({
  columns,
  data = [],
  title = '',
  companyName = '',
  subtitle = '',
  filename = 'export.pdf',
  landscape = true,
  logoUrl = '',
  extraCss = '',
  htmlDir = 'rtl',
  htmlLang = 'ar',
  tableClass = '',
  showPageCounter = true,
  pageMarginMm,
  pdfRowMetas,
}: ExportTableToPdfOpts) {
  let colLabels: unknown[];
  let colKeys: unknown[];
  if (Array.isArray(columns) && columns.length) {
    const norm = normalizeColumnDefs(columns);
    colLabels = norm.labels;
    colKeys = norm.keys;
  } else if (data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
    colLabels = Object.keys(data[0]);
    colKeys = colLabels;
  } else {
    colLabels = [];
    colKeys = [];
  }

  const tblCls = ['pl-pdf-export-table', tableClass].filter(Boolean).join(' ');
  const tableHtml = buildPrintTableHtml({
    columns: buildPrintTableColumns(colLabels, colKeys),
    rows: data,
    wrapperClassName: 'pl-pdf-export-wrap',
    tableClassName: tblCls,
    emptyMessage: htmlLang === 'en' ? 'No data' : 'لا توجد بيانات',
    rowMetas: Array.isArray(pdfRowMetas)
      ? (pdfRowMetas.map((meta) => ({ className: buildPlPdfTrClass(meta) })) satisfies PrintTableRowMeta[])
      : [],
  });

  openPrintWindow({
    title: title || filename.replace('.pdf', ''),
    companyName,
    subtitle,
    landscape,
    logoUrl,
    body: tableHtml,
    extraCss,
    htmlDir,
    htmlLang,
    showPageCounter,
    pageMarginMm,
  });
}

export function exportToPdf(
  opts: string | (Omit<ExportTableToPdfOpts, 'columns'> & { columns?: unknown }),
  filename: string = 'export.pdf',
) {
  if (typeof opts === 'string') {
    exportTableToPdf({ columns: undefined, data: [], title: opts, filename });
  } else {
    exportTableToPdf({ filename, ...opts });
  }
}
