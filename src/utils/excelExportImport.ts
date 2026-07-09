/**
 * تصدير Excel عام + استيراد Excel/CSV (كشوف، قوالب)
 */
import { assertSpreadsheetUploadFile } from './uploadGuards';
import { roundMoney2 } from './moneyInput';
import { normalizeColumnDefs } from './exportNormalize';

type ExportToExcelConfigOpts = {
  companyName?: string;
  title?: string;
  sheetName?: string;
  rtl?: boolean;
  headerColor?: string;
  money2ColumnKeys?: string[];
  moneyColumnFractionDigits?: number;
};

type ExportToExcelObjectArg = {
  data?: unknown;
  filename?: string;
  title?: string;
  companyName?: string;
  sheetName?: string;
  columns?: unknown;
  money2ColumnKeys?: string[];
  moneyColumnFractionDigits?: number;
  /** صف واحد لكل صف بيانات — تنسيق تقرير ربح وخسارة (xlsx-js-style) */
  profitLossRowMeta?: Array<{ rowType?: string; groupKey?: string | null; tone?: string }>;
  rtl?: boolean;
} & Record<string, unknown>;

type SpreadsheetCell = string | number | Date | null | undefined;
type SpreadsheetRow = SpreadsheetCell[];
type ImportedObjectRow = Record<string, unknown>;

function normalizeSpreadsheetCell(cell: unknown): SpreadsheetCell {
  if (
    cell == null ||
    typeof cell === 'string' ||
    typeof cell === 'number' ||
    cell instanceof Date
  ) {
    return cell;
  }
  return String(cell);
}

function normalizeSpreadsheetRow(row: unknown): SpreadsheetRow {
  return Array.isArray(row) ? row.map(normalizeSpreadsheetCell) : [];
}

function normalizeRowsToWidth(rows: SpreadsheetRow[], colCount: number): SpreadsheetRow[] {
  return rows.map((row) => {
    const arr = [...row];
    while (arr.length < colCount) arr.push('');
    return arr;
  });
}

/**
 * exportToExcel — تصدير بيانات إلى Excel مع تنسيق احترافي
 *
 * يقبل نمطين للاستدعاء:
 *   exportToExcel(rows, 'file.xlsx', opts)
 *   exportToExcel({ data: rows, filename, title, companyName, columns, ... })
 *
 * columns يقبل: string[] (مفاتيح/تسميات) أو {key, label}[] (مفتاح للبيانات، label للعرض)
 * money2ColumnKeys + moneyColumnFractionDigits: 0 = مبالغ كأعداد صحيحة؛ 2 = بهللتان (الافتراضي) — القيم تُكتب كرقم في الخلية ليعمل SUM
 */
export async function exportToExcel(
  data: unknown[] | ExportToExcelObjectArg,
  filename: string = 'export.xlsx',
  opts: ExportToExcelConfigOpts = {},
) {
  const XLSXmod = await import('xlsx-js-style');
  const XLSX = XLSXmod.default ?? XLSXmod;

  let configOpts: ExportToExcelConfigOpts = { ...opts };
  let columnDefs: unknown = null;

  let plRowMeta: Array<{ rowType?: string; groupKey?: string | null; tone?: string }> | undefined;

  if (!Array.isArray(data) && data && typeof data === 'object' && 'data' in data) {
    const {
      data: innerData, filename: cfgFile, title: cfgTitle,
      companyName: cfgCo, sheetName: cfgSheet, columns: cfgColumns,
      money2ColumnKeys: cfgMoney2,
      moneyColumnFractionDigits: cfgMoneyFrac,
      profitLossRowMeta: cfgPlMeta,
      rtl: cfgRtl,
    } = data as ExportToExcelObjectArg;
    if (cfgFile) filename = cfgFile;
    if (cfgCo && !configOpts.companyName) configOpts = { companyName: cfgCo, ...configOpts };
    if (cfgTitle && !configOpts.title) configOpts = { title: cfgTitle, ...configOpts };
    if (cfgSheet && !configOpts.sheetName) configOpts = { sheetName: cfgSheet, ...configOpts };
    if (Array.isArray(cfgColumns) && cfgColumns.length) columnDefs = cfgColumns;
    if (cfgMoney2) configOpts = { ...configOpts, money2ColumnKeys: cfgMoney2 };
    if (typeof cfgMoneyFrac === 'number') {
      configOpts = { ...configOpts, moneyColumnFractionDigits: cfgMoneyFrac };
    }
    if (Array.isArray(cfgPlMeta) && cfgPlMeta.length) plRowMeta = cfgPlMeta;
    if (typeof cfgRtl === 'boolean') configOpts = { ...configOpts, rtl: cfgRtl };
    data = (Array.isArray(innerData) ? innerData : []) as unknown[];
  }

  const rowsInput = (Array.isArray(data) ? data : []) as Record<string, unknown>[];

  const {
    companyName = '',
    title = '',
    sheetName = 'بيانات',
    rtl = true,
    headerColor = '185FA5',
    money2ColumnKeys: money2ColumnKeysOpt,
    /** @type {number|undefined} 0 = ريال كامل في التقرير (بدون كسور)؛ 2 = بهللتان */
    moneyColumnFractionDigits: moneyColumnFractionDigitsOpt,
  } = configOpts;

  const money2KeySet = new Set(
    Array.isArray(money2ColumnKeysOpt) ? money2ColumnKeysOpt.filter(Boolean) : [],
  );

  const moneyFrac =
    moneyColumnFractionDigitsOpt === 0
      ? 0
      : (typeof moneyColumnFractionDigitsOpt === 'number' && moneyColumnFractionDigitsOpt >= 0
        ? moneyColumnFractionDigitsOpt
        : 2);

  let headers: string[];
  let dataKeys: string[];
  if (columnDefs != null && Array.isArray(columnDefs) && columnDefs.length) {
    const { labels, keys } = normalizeColumnDefs(columnDefs);
    headers = labels;
    dataKeys = keys;
  } else {
    headers = rowsInput.length ? Object.keys(rowsInput[0]) : [];
    dataKeys = headers;
  }

  const companyRow = companyName ? 1 : 0;
  const titleRow = title ? 1 : 0;
  const headerRowR = companyRow + titleRow;

  const dataAoA = rowsInput.map((row) =>
    dataKeys.map((k) => {
      const v = row[k];
      if (v == null || v === '') return '';
      if (money2KeySet.has(k)) {
        const raw = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
        if (!Number.isFinite(raw)) return '';
        const m = roundMoney2(raw);
        if (moneyFrac === 0) return Math.round(m);
        return Number.parseFloat(m.toFixed(moneyFrac));
      }
      if (typeof v === 'number') return v;
      const s = String(v).replace(/,/g, '').trim();
      const n = Number(s);
      return s !== '' && !isNaN(n) ? n : normalizeSpreadsheetCell(v);
    }),
  );

  const aoa: SpreadsheetRow[] = [];
  if (companyName) aoa.push([companyName, ...Array(Math.max(0, headers.length - 1)).fill('')]);
  if (title) aoa.push([title, ...Array(Math.max(0, headers.length - 1)).fill('')]);
  aoa.push([...headers]);
  aoa.push(...dataAoA);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  if (!ws['!views']) ws['!views'] = [{}];
  if (rtl) ws['!views'][0].rightToLeft = true;
  ws['!views'][0].state = 'frozen';
  ws['!views'][0].ySplit = headerRowR + 1;
  ws['!views'][0].xSplit = 0;
  if (headers.length > 0) {
    ws['!views'][0].topLeftCell = XLSX.utils.encode_cell({ r: headerRowR + 1, c: 0 });
  }

  if (!ws['!merges']) ws['!merges'] = [];

  if (companyName && headers.length > 0) {
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
    const addr = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, sz: 15, color: { rgb: '0F172A' } },
        alignment: { horizontal: rtl ? 'right' : 'left', vertical: 'center' },
      };
    }
  }

  if (title && headers.length > 0) {
    ws['!merges'].push({ s: { r: companyRow, c: 0 }, e: { r: companyRow, c: headers.length - 1 } });
    const addr = XLSX.utils.encode_cell({ r: companyRow, c: 0 });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, sz: 12, color: { rgb: '374151' } },
        alignment: { horizontal: rtl ? 'right' : 'left', vertical: 'center' },
      };
    }
  }

  headers.forEach((h, ci) => {
    const addr = XLSX.utils.encode_cell({ r: headerRowR, c: ci });
    if (!ws[addr]) ws[addr] = { v: h, t: 's' };
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: headerColor } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: rtl ? 'right' : 'left', vertical: 'center', wrapText: false },
    };
  });

  function plExcelRowFill(meta: { rowType?: string; groupKey?: string | null }) {
    if (!meta?.rowType) return undefined;
    if (meta.rowType === 'summary') return { patternType: 'solid' as const, fgColor: { rgb: 'EEF2FF' } };
    if (meta.rowType === 'group') {
      if (meta.groupKey === 'sales') return { patternType: 'solid' as const, fgColor: { rgb: 'EFF6FF' } };
      if (meta.groupKey === 'purchases') return { patternType: 'solid' as const, fgColor: { rgb: 'FEF2F2' } };
      if (meta.groupKey === 'expenses') return { patternType: 'solid' as const, fgColor: { rgb: 'FFFBEB' } };
      return { patternType: 'solid' as const, fgColor: { rgb: 'F1F5F9' } };
    }
    if (meta.rowType === 'category') return { patternType: 'solid' as const, fgColor: { rgb: 'F8FAFC' } };
    return undefined;
  }

  if (plRowMeta && plRowMeta.length === rowsInput.length && rowsInput.length > 0) {
    for (let ri = 0; ri < rowsInput.length; ri++) {
      const meta = plRowMeta[ri] || {};
      const isGroupOrSummary = meta.rowType === 'group' || meta.rowType === 'summary';
      const fillBase = plExcelRowFill(meta);
      const fillZebra =
        fillBase ||
        ((meta.rowType === 'item' || meta.rowType === 'category') && ri % 2 === 1
          ? { patternType: 'solid' as const, fgColor: { rgb: 'F9FAFB' } }
          : undefined);
      for (let ci = 0; ci < headers.length; ci++) {
        const addr = XLSX.utils.encode_cell({ r: headerRowR + 1 + ri, c: ci });
        if (!ws[addr]) continue;
        const isFirst = ci === 0;
        const isNumericCol = !isFirst;
        const rawV = ws[addr].v;
        const isPercentCell = typeof rawV === 'string' && /%/.test(rawV);
        let fontRgb = '1e293b';
        if (isGroupOrSummary && isNumericCol && !isPercentCell && meta.tone === 'neg') fontRgb = 'b91c1c';
        if (isGroupOrSummary && isNumericCol && !isPercentCell && meta.tone === 'pos') fontRgb = '15803d';
        ws[addr].s = {
          ...(fillZebra ? { fill: fillZebra } : {}),
          font: { name: 'Calibri', sz: isGroupOrSummary ? 11 : 10, bold: isGroupOrSummary, color: { rgb: fontRgb } },
          alignment: {
            horizontal: rtl
              ? isFirst
                ? 'right'
                : 'right'
              : isFirst
                ? 'left'
                : 'right',
            vertical: 'center',
            wrapText: isFirst,
          },
        };
      }
    }
  }

  if (headers.length) {
    ws['!cols'] = headers.map((label, ci) => {
      const maxLen = dataAoA.reduce((m, row) => Math.max(m, String(row[ci] ?? '').length), String(label).length);
      return { wch: Math.min(Math.max(maxLen + 2, 8), 52) };
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  if (!filename.toLowerCase().endsWith('.xlsx')) filename += '.xlsx';
  XLSX.writeFile(wb, filename);
}

/**
 * importFromExcel — قراءة ملف Excel وإرجاع صفوف كـ JSON
 * @param {File} file
 * @param {{ headerRow?: number }} opts - headerRow: صف العناوين (0=الأول، 1=الثاني، ...)
 * @returns {Promise<Object[]>}
 */
export async function importFromExcel(file: File, opts: { headerRow?: number } = {}) {
  assertSpreadsheetUploadFile(file);
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', dateNF: 'yyyy-mm-dd' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const { headerRow = 0 } = opts;

  if (headerRow > 0) {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as SpreadsheetRow[];
    if (!raw.length || raw.length <= headerRow) return [];
    const headerRowData = raw[headerRow];
    const headers = headerRowData.map((h, i) => String(h || '').trim() || `العمود_${i + 1}`);
    return raw.slice(headerRow + 1).map((row) => {
      const rowArr = row;
      const obj: ImportedObjectRow = {};
      headers.forEach((h, i) => {
        obj[h] = rowArr[i] ?? '';
      });
      return obj;
    });
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as ImportedObjectRow[];
  if (rows.length && typeof rows[0] === 'object') {
    const keys = Object.keys(rows[0]);
    const badKeys = keys.filter((k) => !k || k.startsWith('__') || /^[A-Z]+$/.test(k));
    if (badKeys.length === keys.length && keys.length > 0) {
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as SpreadsheetRow[];
      if (raw.length >= 2) {
        const headerCells = raw[0];
        const headers = headerCells.map((h, i) => String(h || '').trim() || `العمود_${i + 1}`);
        return raw.slice(1).map((row) => {
          const rowArr = row;
          const obj: ImportedObjectRow = {};
          headers.forEach((h, i) => {
            obj[h] = rowArr[i] ?? '';
          });
          return obj;
        });
      }
    }
  }
  return rows;
}

/**
 * importExcelRaw — قراءة Excel كصفوف خام (مصفوفة مصفوفات) بدون افتراض عناوين
 */
export async function importExcelRaw(file: File) {
  assertSpreadsheetUploadFile(file);
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
  let bestRows: SpreadsheetRow[] = [];
  let maxDataRows = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const rows = json.map(normalizeSpreadsheetRow);
    const dataRows = rows.filter((row) => row.filter((c) => c !== '' && c != null).length >= 2);
    if (dataRows.length > maxDataRows) {
      maxDataRows = dataRows.length;
      bestRows = rows;
    }
  }
  const colCount = bestRows.length ? Math.max(...bestRows.map((r) => r.length)) : 0;
  const normalized = normalizeRowsToWidth(bestRows, colCount);
  return { raw: normalized, colCount };
}

/**
 * importBankStatementFile — قراءة Excel أو CSV كصفوف خام لتحليل الكشف
 */
export async function importBankStatementFile(file: File) {
  assertSpreadsheetUploadFile(file);
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (ext === 'csv') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const raw = lines.map((line) => {
      const parts = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQ = !inQ;
        else if ((c === ',' || c === ';' || c === '\t') && !inQ) {
          parts.push(String(cur).replace(/^"|"$/g, '').trim());
          cur = '';
        } else cur += c;
      }
      parts.push(String(cur).replace(/^"|"$/g, '').trim());
      return parts;
    });
    const colCount = raw.length ? Math.max(...raw.map((r) => r.length)) : 0;
    const normalized = normalizeRowsToWidth(raw, colCount);
    return { raw: normalized, colCount };
  }
  return importExcelRaw(file);
}
