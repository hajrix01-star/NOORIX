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
import { totalSalary, basicSalaryFromTargetTotalInclusiveOvertime } from '../modules/HR/utils/employeeSalaryMath';
import { roundMoney2 } from './moneyInput';

// ─── Low-level helpers ───────────────────────────────────────────────────────

const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
function toWesternNum(str) {
  if (str == null) return '';
  return String(str).replace(/[٠-٩]/g, (c) => AR_NUMS.indexOf(c).toString());
}

/** Parse an Excel date cell (serial number, string DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY) → 'YYYY-MM-DD' | null */
function parseDate(val) {
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
function parseBoolean(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val ?? '').trim().toLowerCase();
  if (['نعم', 'yes', 'true', '1', 'صح', 'y'].includes(s)) return true;
  if (['لا', 'no', 'false', '0', 'خطأ', 'n'].includes(s)) return false;
  return null;
}

/** Parse a numeric cell; strips commas, Arabic numerals → number | null */
function parseNumber(val) {
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

export async function downloadEmployeeTemplate() {
  const rows = [
    {
      'الاسم بالعربية': 'محمد أحمد',
      'الاسم بالإنجليزية': 'Mohammed Ahmed',
      'رقم الإقامة': '',
      'المسمى الوظيفي': 'محاسب',
      'الراتب الأساسي': 5000,
      'بدل السكن': 1000,
      'بدل النقل': 500,
      'بدلات أخرى': 0,
      'الراتب الإجمالي': '',
      'تاريخ الالتحاق': '2024-01-01',
      'ساعات العمل': '8 ساعات',
      'ملاحظات': 'مثال: «الراتب الإجمالي» اختياري — إن حدّدته يُحسب الراتب الأساسي تلقائياً (بدل تركه فارغاً وملء «الراتب الأساسي» فقط).',
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
  const today = new Date().toISOString().slice(0, 10);

  return rows.map((row, i) => {
    const errors = [];
    const warnings = [];
    const rowNum = i + 2;

    const nameAr = String(row['الاسم بالعربية'] ?? row['name'] ?? '').trim();
    const nameEn = String(row['الاسم بالإنجليزية'] ?? row['nameEn'] ?? '').trim() || undefined;
    const displayName = nameAr || nameEn || '';
    if (!displayName) {
      errors.push('يجب إدخال الاسم بالعربية أو بالإنجليزية (أحدهما على الأقل)');
    }

    const basicRaw = parseNumber(row['الراتب الأساسي'] ?? row['basicSalary']);
    const totalTargetRaw = parseNumber(
      row['الراتب الإجمالي'] ?? row['totalSalary'] ?? row['الراتب الأجمالي'] ?? row['Gross salary'],
    );

    const joinDateRaw = row['تاريخ الالتحاق'] ?? row['joinDate'];
    let joinDate = parseDate(joinDateRaw);
    if (!joinDate) joinDate = today;

    let iqamaNumber = String(row['رقم الإقامة'] ?? row['iqamaNumber'] ?? '').trim() || undefined;
    const jobTitle = String(row['المسمى الوظيفي'] ?? row['jobTitle'] ?? '').trim() || undefined;
    const housingAllowance = Math.max(0, parseNumber(row['بدل السكن'] ?? row['housingAllowance'] ?? 0) ?? 0);
    const transportAllowance = Math.max(0, parseNumber(row['بدل النقل'] ?? row['transportAllowance'] ?? 0) ?? 0);
    const otherAllowance = Math.max(0, parseNumber(row['بدلات أخرى'] ?? row['otherAllowance'] ?? 0) ?? 0);
    const workHours = String(row['ساعات العمل'] ?? row['workHours'] ?? '').trim() || undefined;
    const notes = String(row['ملاحظات'] ?? row['notes'] ?? '').trim() || undefined;

    const useTotalTarget = totalTargetRaw != null && totalTargetRaw > 0;
    let basicSalary = basicRaw === null || basicRaw < 0 ? 0 : basicRaw;
    if (useTotalTarget) {
      const empForInverse = {
        basicSalary: 0,
        housingAllowance,
        transportAllowance,
        otherAllowance,
        workHours,
        workSchedule: '',
      };
      const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
        empForInverse,
        0,
        totalTargetRaw,
      );
      basicSalary = basic;
      if (inverseWarning) {
        warnings.push('تعذّر مواءمة «الراتب الإجمالي» مع البدلات والأوفر تايم — راجع المبالغ.');
      }
      if (basicRaw != null && basicRaw > 0) {
        warnings.push('يُستمد الراتب الأساسي من «الراتب الإجمالي» (يُتجاهل «الراتب الأساسي» في الملف).');
      }
    }

    if (iqamaNumber && !/^\d{10}$/.test(iqamaNumber)) {
      warnings.push(`رقم الإقامة "${iqamaNumber}" ليس 10 أرقام — يُفضّل تصحيحه أو تركه فارغاً.`);
    }

    return {
      rowNum,
      errors,
      warnings,
      valid: errors.length === 0,
      payload: errors.length === 0
        ? {
            name: displayName,
            nameEn,
            iqamaNumber,
            jobTitle,
            basicSalary,
            housingAllowance,
            transportAllowance,
            otherAllowance,
            joinDate,
            workHours,
            notes,
          }
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

/**
 * @param {Array<{ employeeId?: string, amount?: unknown }>} allowanceRows
 * @returns {Map<string, number>}
 */
export function buildEmployeeAllowanceTotalsMap(allowanceRows) {
  const map = new Map();
  for (const row of allowanceRows || []) {
    const id = row.employeeId;
    if (!id) continue;
    const next = (map.get(id) || 0) + (Number(row.amount) || 0);
    map.set(id, roundMoney2(next));
  }
  return map;
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

/**
 * @param {object} emp
 * @param {Map<string, number>|null|undefined} allowanceTotalsByEmployeeId — مجموع البدلات المخصصة لكل موظف
 */
export function formatEmployeeForExport(emp, allowanceTotalsByEmployeeId) {
  const customExtra =
    allowanceTotalsByEmployeeId instanceof Map
      ? (allowanceTotalsByEmployeeId.get(emp.id) || 0)
      : 0;
  const ts = totalSalary(emp, customExtra);
  const totalRounded = Number.isFinite(ts) ? roundMoney2(ts) : 0;
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
    'الراتب الإجمالي': totalRounded,
    'تاريخ الالتحاق': emp.joinDate?.slice(0, 10) ?? '',
    'ساعات العمل': emp.workHours ?? '',
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
