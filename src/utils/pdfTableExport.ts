/**
 * تصدير جداول إلى PDF عبر نافذة الطباعة
 */
import { openPrintWindow } from './printUtils';
import { normalizeColumnDefs } from './exportNormalize';

/**
 * exportTableToPdf — يفتح نافذة طباعة HTML (المتصفح يتولى التحويل لـ PDF)
 * @param {{ columns?, data, title?, companyName?, subtitle?, filename?, landscape? }} opts
 */
type ExportTableToPdfOpts = {
  columns?: unknown;
  data?: unknown[];
  title?: string;
  companyName?: string;
  subtitle?: string;
  filename?: string;
  landscape?: boolean;
  logoUrl?: string;
};

export function exportTableToPdf({
  columns,
  data = [],
  title = '',
  companyName = '',
  subtitle = '',
  filename = 'export.pdf',
  landscape = true,
  logoUrl = '',
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
    ? data.map((row: any) => {
        const cells = Array.isArray(row)
          ? row.map((c: any) => `<td>${esc(c)}</td>`).join('')
          : colKeys.map((k: any) => `<td>${esc(row[k])}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('')
    : `<tr><td colspan="${colLabels.length || 1}" style="text-align:center;color:#888">لا توجد بيانات</td></tr>`;

  const tableHtml = `<table><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table>`;

  openPrintWindow({
    title: title || filename.replace('.pdf', ''),
    companyName,
    subtitle,
    landscape,
    logoUrl,
    body: tableHtml,
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
