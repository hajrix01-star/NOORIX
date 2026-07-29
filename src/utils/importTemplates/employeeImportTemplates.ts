import { totalSalary, overtimePay, basicSalaryFromTargetTotalInclusiveOvertime } from '../../modules/HR/utils/employeeSalaryMath';
import { exportToExcel } from '../exportUtils';
import { roundMoney2 } from '../moneyInput';
import { getSaudiToday, toYmd } from '../saudiDate';
import { parseDate, parseNumber } from './core';
import type { EmployeeExportSalaryRow, ValidationResult } from './core';

// ─── Employee Template ───────────────────────────────────────────────────────

/** أعمدة مبالغ — تُمرَّر لـ exportToExcel({ money2ColumnKeys }) لعرض بهللتين كنص */
export const EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS = [
  'الراتب الأساسي',
  'بدل السكن',
  'بدل النقل',
  'بدلات أخرى',
  'مجموع البدلات المخصصة',
  'مقابل الأوفر تايم (مُقدّر)',
  'الراتب الإجمالي',
];

/** خيارات تصدير Excel للموظفين — مبالغ كأرقام صحيحة بلا عشريات */
export const EMPLOYEE_EXCEL_EXPORT_OPTS = {
  money2ColumnKeys: EMPLOYEE_EXCEL_MONEY_COLUMN_KEYS,
  moneyColumnFractionDigits: 0,
};

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
  await exportToExcel(rows, 'template-employees.xlsx', EMPLOYEE_EXCEL_EXPORT_OPTS);
}

// ─── Employee Row Validator ──────────────────────────────────────────────────

/**
 * @param {Object[]} rows
 * @returns {{ rowNum: number, valid: boolean, errors: string[], warnings: string[], payload: Object|null }[]}
 */
export function validateEmployeeRows(rows: Record<string, unknown>[]) {
  const today = getSaudiToday();

  return rows.map((row, i): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];
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

export function buildEmployeeAllowanceTotalsMap(
  allowanceRows: ReadonlyArray<{ employeeId?: string; amount?: unknown }> | null | undefined,
) {
  const map = new Map<string, number>();
  for (const row of allowanceRows || []) {
    const id = row.employeeId;
    if (!id) continue;
    const next = (map.get(id) || 0) + (Number(row.amount) || 0);
    map.set(id, roundMoney2(next));
  }
  return map;
}

export function formatEmployeeForExport(
  emp: EmployeeExportSalaryRow,
  allowanceTotalsByEmployeeId: Map<string, number> | null | undefined,
) {
  const employeeId = typeof emp.id === 'string' ? emp.id : '';
  const customExtra =
    allowanceTotalsByEmployeeId instanceof Map
      ? (allowanceTotalsByEmployeeId.get(employeeId) || 0)
      : 0;
  const ts = totalSalary(emp, customExtra);
  const totalRounded = Number.isFinite(ts) ? roundMoney2(ts) : 0;
  const ot = roundMoney2(overtimePay(emp, customExtra));
  const customRounded = roundMoney2(customExtra);
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
    // يفسّر الفارق مع «الراتب الإجمالي» (ليست مذكورة في أعمدة أجور السجل فقط)
    'مجموع البدلات المخصصة': customRounded,
    'مقابل الأوفر تايم (مُقدّر)': ot,
    'الراتب الإجمالي': totalRounded,
    'تاريخ الالتحاق': toYmd(emp.joinDate) || '',
    'ساعات العمل': emp.workHours ?? '',
    'الحالة': emp.status === 'active' ? 'نشط' : (emp.status === 'terminated' ? 'منتهي' : emp.status),
    'ملاحظات': emp.notes ?? '',
  };
}
