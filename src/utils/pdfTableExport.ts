/**
 * تصدير جداول إلى PDF عبر نافذة الطباعة
 */
import { openPrintWindow } from './printUtils';
import { normalizeColumnDefs } from './exportNormalize';

/**
 * exportTableToPdf — يفتح نافذة طباعة HTML (المتصفح يتولى التحويل لـ PDF)
 * @param {{ columns?, data, title?, companyName?, subtitle?, filename?, landscape? }} opts
 */
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
  /** CSS إضافي (مثل تنسيق تقرير ربح وخسارة) */
  extraCss?: string;
  htmlDir?: 'rtl' | 'ltr';
  htmlLang?: string;
  tableClass?: string;
  showPageCounter?: boolean;
  pageMarginMm?: number;
  /** صف واحد لكل صف بيانات — لأصناف الصفوف في PDF */
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
  let colLabels;
  let colKeys;
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

  const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const headRow = `<tr>${colLabels.map((l: any) => `<th>${esc(l)}</th>`).join('')}</tr>`;
  const bodyRows = data.length
    ? data.map((row: any, ri: number) => {
        const cells = Array.isArray(row)
          ? row.map((c: any) => `<td>${esc(c)}</td>`).join('')
          : colKeys.map((k: any) => `<td>${esc(row[k])}</td>`).join('');
        const trCls = Array.isArray(pdfRowMetas) && pdfRowMetas[ri] ? buildPlPdfTrClass(pdfRowMetas[ri]) : '';
        const trClsAttr = trCls ? trCls.replace(/"/g, '') : '';
        return `<tr${trClsAttr ? ` class="${trClsAttr}"` : ''}>${cells}</tr>`;
      }).join('')
    : `<tr><td colspan="${colLabels.length || 1}" style="text-align:center;color:#888">لا توجد بيانات</td></tr>`;

  const tblCls = ['pl-pdf-export-table', tableClass].filter(Boolean).join(' ');
  const tableHtml = `<div class="pl-pdf-export-wrap"><table class="${esc(tblCls)}"><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table></div>`;

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
  opts: string | Omit<ExportTableToPdfOpts, 'columns'> & { columns?: unknown },
  filename: any = 'export.pdf',
) {
  if (typeof opts === 'string') {
    exportTableToPdf({ columns: undefined, data: [], title: opts, filename });
  } else {
    exportTableToPdf({ filename, ...opts });
  }
}
