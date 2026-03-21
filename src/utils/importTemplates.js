/**
 * importTemplates.js
 * Template generation, row validation, and export formatting for bulk import/export.
 * Entities: invoices, employees, daily-sales
 *
 * Design: all Excel parsing happens on the frontend (xlsx library).
 * The validators return { rowNum, valid, errors[], warnings[], payload } per row.
 * Payloads are then sent to existing backend endpoints in parallel batches.
 */
import { exportToExcel } from './exportUtils';

// ─── Low-level helpers ───────────────────────────────────────────────────────

const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
function toWesternNum(str) {
  if (str == null) return '';
  return String(str).replace(/[٠-٩]/g, (c) => AR_NUMS.indexOf(c).toString());
}

/** Parse an Excel date cell (serial number, string DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY) → 'YYYY-MM-DD' | null */
export function parseDate(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const str = toWesternNum(String(val).trim());
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const dmy2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Parse boolean from Arabic/English/numeric values → true | false | null (unrecognised) */
export function parseBoolean(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val ?? '').trim().toLowerCase();
  if (['نعم', 'yes', 'true', '1', 'صح', 'y'].includes(s)) return true;
  if (['لا', 'no', 'false', '0', 'خطأ', 'n'].includes(s)) return false;
  return null;
}

/** Parse a numeric cell; strips commas, Arabic numerals → number | null */
export function parseNumber(val) {
  if (val == null || val === '') return null;
  const s = toWesternNum(String(val).replace(/,/g, '').replace(/\s/g, '').trim());
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/** Find an item in a list by nameAr or nameEn (case-insensitive) */
function matchByName(list, name, nameArKey = 'nameAr', nameEnKey = 'nameEn') {
  if (!name) return null;
  const needle = String(name).trim().toLowerCase();
  return list.find(
    (item) =>
      String(item[nameArKey] ?? '').trim().toLowerCase() === needle ||
      String(item[nameEnKey] ?? '').trim().toLowerCase() === needle,
  ) || null;
}

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

/** Columns expected in the invoice import template */
export const INVOICE_TEMPLATE_COLUMNS = [
  'تاريخ الفاتورة',        // required  YYYY-MM-DD or DD/MM/YYYY
  'نوع الفاتورة',           // required  مشتريات | مصروف | ...
  'المبلغ الإجمالي',        // required  positive number
  'خاضع للضريبة',          // optional  نعم / لا  (default: نعم)
  'رقم فاتورة المورد',      // optional
  'اسم المورد',             // optional  matched by name → supplierId
  'اسم الصندوق',            // optional  matched by name → vaultId
  'اسم الفئة',              // optional  matched by name → categoryId
  'بند المصروف',            // optional  matched by name → expenseLineId
  'ملاحظات',                // optional
];

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

// ─── Employee Template ───────────────────────────────────────────────────────

export const EMPLOYEE_TEMPLATE_COLUMNS = [
  'الاسم بالعربية',                  // required
  'الاسم بالإنجليزية',               // optional
  'رقم الإقامة',                     // optional
  'المسمى الوظيفي',                   // optional
  'الراتب الأساسي',                   // required  number >= 0
  'بدل السكن',                       // optional  number >= 0
  'بدل النقل',                       // optional  number >= 0
  'بدلات أخرى',                      // optional  number >= 0
  'تاريخ الالتحاق',                   // required  YYYY-MM-DD or DD/MM/YYYY
  'ساعات العمل',                     // optional  text
  'ملاحظات',                         // optional
];

export async function downloadEmployeeTemplate() {
  const rows = [
    {
      'الاسم بالعربية': 'محمد أحمد',
      'الاسم بالإنجليزية': 'Mohammed Ahmed',
      'رقم الإقامة': '2123456789',
      'المسمى الوظيفي': 'محاسب',
      'الراتب الأساسي': 5000,
      'بدل السكن': 1000,
      'بدل النقل': 500,
      'بدلات أخرى': 0,
      'تاريخ الالتحاق': '2024-01-01',
      'ساعات العمل': '8 ساعات',
      'ملاحظات': 'صف مثال — احذفه واستبدله ببياناتك',
    },
  ];
  await exportToExcel(rows, 'template-employees.xlsx');
}

// ─── Sales Template ──────────────────────────────────────────────────────────

/** vaults: array of vault objects with nameAr/nameEn */
export async function downloadSalesTemplate(vaults = []) {
  const vaultColumns =
    vaults.length > 0
      ? vaults.reduce((acc, v) => { acc[`قناة: ${v.nameAr || v.nameEn || v.id}`] = 0; return acc; }, {})
      : { 'قناة: الصندوق الرئيسي': 5000, 'قناة: شبكة البنك': 3000 };

  const rows = [
    {
      'تاريخ اليوم': '2025-01-15',
      'عدد العملاء': 120,
      'النقد في اليد': 200,
      'ملاحظات': 'صف مثال — احذفه واستبدله ببياناتك',
      ...vaultColumns,
    },
  ];
  await exportToExcel(rows, 'template-daily-sales.xlsx');
}

// ─── Invoice Row Validator ───────────────────────────────────────────────────

/**
 * Validate rows parsed from an invoice Excel file.
 * Returns an array of result objects, one per row.
 * @param {Object[]} rows - raw rows from importFromExcel()
 * @param {{ suppliers: Object[], vaults: Object[], categories: Object[], expenseLines: Object[] }} lookups
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateInvoiceRows(rows, { suppliers = [], vaults = [], categories = [], expenseLines = [] } = {}) {
  const validKinds = new Set(Object.keys(INVOICE_KIND_LABELS));

  return rows.map((row, i) => {
    const errors = [];
    const warnings = [];
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
      if (found) supplierId = found.id;
      else warnings.push(`المورد "${supplierNameRaw}" غير موجود في النظام`);
    }

    // vault lookup
    const vaultNameRaw = String(row['اسم الصندوق'] ?? row['vaultName'] ?? '').trim();
    let vaultId;
    if (vaultNameRaw) {
      const found = matchByName(vaults, vaultNameRaw);
      if (found) vaultId = found.id;
      else warnings.push(`الصندوق "${vaultNameRaw}" غير موجود في النظام`);
    }

    // category lookup
    const catNameRaw = String(row['اسم الفئة'] ?? row['categoryName'] ?? '').trim();
    let categoryId;
    if (catNameRaw) {
      const found = matchByName(categories, catNameRaw);
      if (found) categoryId = found.id;
      else warnings.push(`الفئة "${catNameRaw}" غير موجودة في النظام`);
    }

    // expenseLine lookup
    const elNameRaw = String(row['بند المصروف'] ?? row['expenseLineName'] ?? '').trim();
    let expenseLineId;
    if (elNameRaw) {
      const found = matchByName(expenseLines, elNameRaw);
      if (found) expenseLineId = found.id;
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

// ─── Employee Row Validator ──────────────────────────────────────────────────

/**
 * @param {Object[]} rows
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateEmployeeRows(rows) {
  return rows.map((row, i) => {
    const errors = [];
    const warnings = [];
    const rowNum = i + 2;

    const name = String(row['الاسم بالعربية'] ?? row['name'] ?? '').trim();
    if (!name) errors.push('الاسم بالعربية مطلوب');

    const basicSalary = parseNumber(row['الراتب الأساسي'] ?? row['basicSalary']);
    if (basicSalary === null || basicSalary < 0) errors.push('الراتب الأساسي يجب أن يكون صفراً أو أكبر');

    const joinDateRaw = row['تاريخ الالتحاق'] ?? row['joinDate'];
    const joinDate = parseDate(joinDateRaw);
    if (!joinDate) errors.push('تاريخ الالتحاق مطلوب أو غير صحيح');

    const nameEn = String(row['الاسم بالإنجليزية'] ?? row['nameEn'] ?? '').trim() || undefined;
    const iqamaNumber = String(row['رقم الإقامة'] ?? row['iqamaNumber'] ?? '').trim() || undefined;
    const jobTitle = String(row['المسمى الوظيفي'] ?? row['jobTitle'] ?? '').trim() || undefined;
    const housingAllowance = Math.max(0, parseNumber(row['بدل السكن'] ?? row['housingAllowance'] ?? 0) ?? 0);
    const transportAllowance = Math.max(0, parseNumber(row['بدل النقل'] ?? row['transportAllowance'] ?? 0) ?? 0);
    const otherAllowance = Math.max(0, parseNumber(row['بدلات أخرى'] ?? row['otherAllowance'] ?? 0) ?? 0);
    const workHours = String(row['ساعات العمل'] ?? row['workHours'] ?? '').trim() || undefined;
    const notes = String(row['ملاحظات'] ?? row['notes'] ?? '').trim() || undefined;

    if (iqamaNumber && !/^\d{10}$/.test(iqamaNumber)) {
      warnings.push(`رقم الإقامة "${iqamaNumber}" يجب أن يتكون من 10 أرقام`);
    }

    return {
      rowNum,
      errors,
      warnings,
      valid: errors.length === 0,
      payload: errors.length === 0
        ? { name, nameEn, iqamaNumber, jobTitle, basicSalary: basicSalary ?? 0, housingAllowance, transportAllowance, otherAllowance, joinDate, workHours, notes }
        : null,
    };
  });
}

// ─── Sales Row Validator ─────────────────────────────────────────────────────

/**
 * @param {Object[]} rows
 * @param {{ vaults: Object[] }} options
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateSalesRows(rows, { vaults = [] } = {}) {
  const seenDates = new Set();

  return rows.map((row, i) => {
    const errors = [];
    const warnings = [];
    const rowNum = i + 2;

    const dateRaw = row['تاريخ اليوم'] ?? row['transactionDate'] ?? row['التاريخ'] ?? row['date'];
    const transactionDate = parseDate(dateRaw);
    if (!transactionDate) {
      errors.push('تاريخ اليوم مطلوب أو غير صحيح');
    } else if (seenDates.has(transactionDate)) {
      errors.push(`التاريخ ${transactionDate} مكرر في الملف`);
    } else {
      seenDates.add(transactionDate);
    }

    const customerCount = Math.max(0, parseNumber(row['عدد العملاء'] ?? row['customerCount'] ?? 0) ?? 0);
    const cashOnHand = String(Math.max(0, parseNumber(row['النقد في اليد'] ?? row['cashOnHand'] ?? 0) ?? 0));
    const notes = String(row['ملاحظات'] ?? row['notes'] ?? '').trim() || undefined;

    // Extract vault channels from columns prefixed with "قناة: " or "channel: "
    const channels = [];
    for (const [colKey, rawAmount] of Object.entries(row)) {
      const prefix = colKey.startsWith('قناة: ') ? 'قناة: ' : colKey.startsWith('channel: ') ? 'channel: ' : null;
      if (!prefix) continue;
      const vaultName = colKey.slice(prefix.length).trim();
      const amt = parseNumber(rawAmount);
      if (!amt || amt <= 0) continue;
      const vault = matchByName(vaults, vaultName);
      if (vault) {
        channels.push({ vaultId: vault.id, amount: String(amt) });
      } else {
        warnings.push(`الصندوق "${vaultName}" غير موجود في النظام`);
      }
    }

    if (channels.length === 0 && errors.length === 0) {
      errors.push('يجب تحديد قناة بيع واحدة على الأقل بمبلغ أكبر من صفر');
    }

    return {
      rowNum,
      errors,
      warnings,
      valid: errors.length === 0,
      payload: errors.length === 0
        ? { transactionDate, customerCount, cashOnHand, notes, channels }
        : null,
    };
  });
}

// ─── Export formatters (convert API response rows to Excel-friendly objects) ──

export function formatInvoiceForExport(inv) {
  return {
    'تاريخ الفاتورة': inv.transactionDate?.slice(0, 10) ?? '',
    'نوع الفاتورة': INVOICE_KIND_LABELS[inv.kind] ?? inv.kind,
    'رقم الفاتورة': inv.invoiceNumber ?? '',
    'رقم فاتورة المورد': inv.supplierInvoiceNumber ?? '',
    'اسم المورد': inv.supplier?.nameAr ?? inv.supplier?.nameEn ?? '',
    'المبلغ الصافي': inv.netAmount ?? '',
    'الضريبة': inv.taxAmount ?? '',
    'المبلغ الإجمالي': inv.totalAmount ?? '',
    'اسم الصندوق': inv.vault?.nameAr ?? inv.vault?.nameEn ?? '',
    'الفئة': inv.category?.nameAr ?? inv.category?.nameEn ?? '',
    'بند المصروف': inv.expenseLine?.nameAr ?? inv.expenseLine?.nameEn ?? '',
    'الحالة': inv.status === 'active' ? 'نشط' : 'ملغى',
    'ملاحظات': inv.notes ?? '',
  };
}

export function formatEmployeeForExport(emp) {
  return {
    'الاسم بالعربية': emp.name ?? '',
    'الاسم بالإنجليزية': emp.nameEn ?? '',
    'رقم الموظف': emp.employeeSerial ?? '',
    'رقم الإقامة': emp.iqamaNumber ?? '',
    'المسمى الوظيفي': emp.jobTitle ?? '',
    'الراتب الأساسي': emp.basicSalary ?? '',
    'بدل السكن': emp.housingAllowance ?? '',
    'بدل النقل': emp.transportAllowance ?? '',
    'بدلات أخرى': emp.otherAllowance ?? '',
    'تاريخ الالتحاق': emp.joinDate?.slice(0, 10) ?? '',
    'الحالة': emp.status === 'active' ? 'نشط' : (emp.status === 'terminated' ? 'منتهي' : emp.status),
    'ملاحظات': emp.notes ?? '',
  };
}

export function formatSalesForExport(summary) {
  const base = {
    'تاريخ اليوم': summary.transactionDate?.slice(0, 10) ?? '',
    'رقم الملخص': summary.summaryNumber ?? '',
    'عدد العملاء': summary.customerCount ?? 0,
    'إجمالي المبيعات': summary.totalAmount ?? '',
    'النقد في اليد': summary.cashOnHand ?? '',
    'الحالة': summary.status === 'active' ? 'نشط' : 'ملغى',
    'ملاحظات': summary.notes ?? '',
  };
  (summary.channels ?? []).forEach((ch) => {
    base[`قناة: ${ch.vault?.nameAr ?? ch.vault?.nameEn ?? ch.vaultId}`] = ch.amount;
  });
  return base;
}
