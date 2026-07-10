import { getSaudiToday } from '../../utils/saudiDate';
import type { SupplierCreatePayload, SupplierImportRow, SupplierRecord } from './supplierTypes';

const CSV_HEADERS_AR = ['الاسم بالعربي *', 'الاسم بالإنجليزي', 'الرقم الضريبي', 'الهاتف', 'نوع المورد (purchases/expenses)'];

const SAMPLE_ROWS = [
  ['مورد تجريبي أول', 'First Test Supplier', '3001234567890', '0501234567', 'purchases'],
  ['مورد مصروفات', '', '', '', 'expenses'],
] satisfies string[][];

export type SupplierImportResult = {
  success: number;
  failed: number;
  errors: string[];
};

export function escapeSupplierCsvCell(value: unknown) {
  const text = String(value ?? '');
  return text.includes(',') || text.includes('"') || text.includes('\n')
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function buildSupplierCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>) {
  return rows.map((row) => row.map(escapeSupplierCsvCell).join(',')).join('\r\n');
}

export function buildSupplierTemplateCsv() {
  return buildSupplierCsv([CSV_HEADERS_AR, ...SAMPLE_ROWS]);
}

export function buildSupplierExportCsv(suppliers: SupplierRecord[]) {
  const rows = suppliers.map((supplier) => [
    supplier.nameAr || '',
    supplier.nameEn || '',
    supplier.taxNumber || '',
    supplier.phone || '',
    supplier.supplierType || 'purchases',
  ]);
  return buildSupplierCsv([CSV_HEADERS_AR, ...rows]);
}

export function buildSupplierExportFilename() {
  return `الموردين_${getSaudiToday()}.csv`;
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseSupplierCsv(text: string): SupplierImportRow[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const isHeader = headerLine.includes('الاسم') || headerLine.includes('اسم') || headerLine.includes('namear');
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line): SupplierImportRow => {
      const cells = splitCsvLine(line);
      const rawType = String(cells[4] || '').toLowerCase();
      return {
        nameAr: cells[0] || '',
        nameEn: cells[1] || undefined,
        taxNumber: cells[2] || undefined,
        phone: cells[3] || undefined,
        supplierType: rawType.includes('expense') ? 'expenses' : 'purchases',
      };
    })
    .filter((row) => row.nameAr.trim());
}

export async function importSupplierRows(
  rows: SupplierImportRow[],
  companyId: string,
  onImport: (body: SupplierCreatePayload) => Promise<unknown>,
) {
  let success = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await onImport({ ...row, companyId, isTaxRegistered: true });
      success += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      errors.push(`"${row.nameAr}": ${message}`);
    }
  }

  return { success, failed: errors.length, errors };
}
