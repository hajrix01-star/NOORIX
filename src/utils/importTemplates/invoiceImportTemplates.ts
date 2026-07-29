import { exportToExcel } from '../exportUtils';
import { toYmd } from '../saudiDate';
import { matchByName, parseBoolean, parseDate, parseNumber } from './core';
import type { ImportRow, ValidationResult } from './core';

// ─── Invoice Template ────────────────────────────────────────────────────────

export const INVOICE_KIND_LABELS = {
  purchase: 'مشتريات',
  expense: 'مصروف',
  hr_expense: 'مصروف موظف',
  fixed_expense: 'مصروف ثابت',
  salary: 'راتب',
  advance: 'سلفة',
};

const INVOICE_KIND_BY_LABEL = Object.fromEntries(
  Object.entries(INVOICE_KIND_LABELS).map(([k, v]) => [v, k]),
);

export async function downloadInvoiceTemplate() {
  const rows = [
    {
      'تاريخ الفاتورة': '2025-01-15',
      'نوع الفاتورة': 'مشتريات',
      'المبلغ الإجمالي': 1150,
      'خاضع للضريبة': 'نعم',
      'رقم فاتورة المورد': 'INV-001',
      'اسم المورد': 'اسم المورد كما في النظام',
      'اسم الصندوق': 'اسم الصندوق كما في النظام',
      'اسم الفئة': '',
      'بند المصروف': '',
      'ملاحظات': 'صف مثال — احذفه واستبدله ببياناتك',
    },
    {
      'تاريخ الفاتورة': '2025-01-16',
      'نوع الفاتورة': 'مصروف',
      'المبلغ الإجمالي': 500,
      'خاضع للضريبة': 'لا',
      'رقم فاتورة المورد': '',
      'اسم المورد': '',
      'اسم الصندوق': '',
      'اسم الفئة': 'الفئة من النظام',
      'بند المصروف': 'بند المصروف من النظام',
      'ملاحظات': 'مصروف بدون ضريبة',
    },
  ];
  await exportToExcel(rows, 'template-invoices.xlsx');
}

// ─── Invoice Row Validator ───────────────────────────────────────────────────

/**
 * Validate rows parsed from an invoice Excel file.
 * Returns an array of result objects, one per row.
 * @param {Object[]} rows - raw rows from importFromExcel()
 * @param {{ suppliers: Object[], vaults: Object[], categories: Object[], expenseLines: Object[] }} lookups
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateInvoiceRows(
  rows: ImportRow[],
  {
    suppliers = [],
    vaults = [],
    categories = [],
    expenseLines = [],
  }: {
    suppliers?: unknown[];
    vaults?: unknown[];
    categories?: unknown[];
    expenseLines?: unknown[];
  } = {},
) {
  const validKinds = new Set(Object.keys(INVOICE_KIND_LABELS));

  return rows.map((row, i): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rowNum = i + 2; // 1-indexed + header row

    // transactionDate
    const dateRaw = row['تاريخ الفاتورة'] ?? row['transactionDate'] ?? row['التاريخ'] ?? row['date'];
    const transactionDate = parseDate(dateRaw);
    if (!transactionDate) errors.push('تاريخ الفاتورة مطلوب أو غير صحيح');

    // kind
    const kindRaw = String(row['نوع الفاتورة'] ?? row['kind'] ?? '').trim();
    const kind = INVOICE_KIND_BY_LABEL[kindRaw] || (validKinds.has(kindRaw) ? kindRaw : null);
    if (!kind) {
      errors.push(`نوع الفاتورة "${kindRaw}" غير صحيح. الأنواع: ${Object.values(INVOICE_KIND_LABELS).join(', ')}`);
    }

    // totalAmount
    const totalAmount = parseNumber(row['المبلغ الإجمالي'] ?? row['totalAmount'] ?? row['المبلغ']);
    if (totalAmount === null || totalAmount <= 0) errors.push('المبلغ الإجمالي يجب أن يكون رقماً أكبر من صفر');

    // isTaxable
    const taxRaw = row['خاضع للضريبة'] ?? row['isTaxable'];
    const isTaxable = taxRaw == null ? true : (parseBoolean(taxRaw) ?? true);
    if (taxRaw != null && parseBoolean(taxRaw) === null) {
      warnings.push('"خاضع للضريبة" قيمة غير مفهومة، سيتم افتراض نعم');
    }

    // supplierInvoiceNumber
    const supplierInvoiceNumber =
      String(row['رقم فاتورة المورد'] ?? row['supplierInvoiceNumber'] ?? '').trim() || undefined;

    // supplier lookup
    const supplierNameRaw = String(row['اسم المورد'] ?? row['supplierName'] ?? '').trim();
    let supplierId;
    if (supplierNameRaw) {
      const found = matchByName(suppliers, supplierNameRaw);
      if (found) supplierId = found.id as string | undefined;
      else warnings.push(`المورد "${supplierNameRaw}" غير موجود في النظام`);
    }

    // vault lookup
    const vaultNameRaw = String(row['اسم الصندوق'] ?? row['vaultName'] ?? '').trim();
    let vaultId;
    if (vaultNameRaw) {
      const found = matchByName(vaults, vaultNameRaw);
      if (found) vaultId = found.id as string | undefined;
      else warnings.push(`الصندوق "${vaultNameRaw}" غير موجود في النظام`);
    }

    // category lookup
    const catNameRaw = String(row['اسم الفئة'] ?? row['categoryName'] ?? '').trim();
    let categoryId;
    if (catNameRaw) {
      const found = matchByName(categories, catNameRaw);
      if (found) categoryId = found.id as string | undefined;
      else warnings.push(`الفئة "${catNameRaw}" غير موجودة في النظام`);
    }

    // expenseLine lookup
    const elNameRaw = String(row['بند المصروف'] ?? row['expenseLineName'] ?? '').trim();
    let expenseLineId;
    if (elNameRaw) {
      const found = matchByName(expenseLines, elNameRaw);
      if (found) expenseLineId = found.id as string | undefined;
      else warnings.push(`بند المصروف "${elNameRaw}" غير موجود في النظام`);
    }

    const notes = String(row['ملاحظات'] ?? row['notes'] ?? '').trim() || undefined;

    return {
      rowNum,
      errors,
      warnings,
      valid: errors.length === 0,
      payload: errors.length === 0
        ? { transactionDate, kind, totalAmount, isTaxable, supplierInvoiceNumber, supplierId, vaultId, categoryId, expenseLineId, notes }
        : null,
    };
  });
}

export function formatInvoiceForExport(inv: Record<string, unknown>) {
  const kindKey = String(inv.kind ?? '');
  const labels = INVOICE_KIND_LABELS as Record<string, string>;
  return {
    'تاريخ الفاتورة': toYmd(inv.transactionDate),
    'نوع الفاتورة': labels[kindKey] ?? kindKey,
    'رقم الفاتورة': inv.invoiceNumber ?? '',
    'رقم فاتورة المورد': inv.supplierInvoiceNumber ?? '',
    'اسم المورد': (() => {
      const s = inv.supplier as Record<string, unknown> | undefined;
      return String(s?.nameAr ?? s?.nameEn ?? '');
    })(),
    'المبلغ الصافي': inv.netAmount ?? '',
    'الضريبة': inv.taxAmount ?? '',
    'المبلغ الإجمالي': inv.totalAmount ?? '',
    'اسم الصندوق': (() => {
      const v = inv.vault as Record<string, unknown> | undefined;
      return String(v?.nameAr ?? v?.nameEn ?? '');
    })(),
    'الفئة': (() => {
      const c = inv.category as Record<string, unknown> | undefined;
      return String(c?.nameAr ?? c?.nameEn ?? '');
    })(),
    'بند المصروف': (() => {
      const e = inv.expenseLine as Record<string, unknown> | undefined;
      return String(e?.nameAr ?? e?.nameEn ?? '');
    })(),
    'الحالة': inv.status === 'active' ? 'نشط' : 'ملغى',
    'ملاحظات': inv.notes ?? '',
  };
}
