/**
 * ثوابت المحادثة: أسئلة جاهزة + مجموعات الأوامر
 */
import { PERMISSIONS } from '../../../constants/permissions';
import type { ChatCommandGroup, PermanentQuestion, PermissionChecker } from '../types';

export const CHAT_PAGE_SIZE = 6;

const canSales = (c: PermissionChecker) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ);
const canVaults = (c: PermissionChecker) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ);
const canReports = (c: PermissionChecker) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ);
const canInvoices = (c: PermissionChecker) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ);
const canSuppliers = (c: PermissionChecker) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ);
const canEmployees = (c: PermissionChecker) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ);

export const PERMANENT_QUESTIONS: PermanentQuestion[] = [
  {
    section: 'reports',
    ar: 'كم مبيعات السنة؟',
    en: 'What are annual sales?',
    shortAr: 'مبيعات السنة',
    shortEn: 'Annual sales',
    domain: canSales,
  },
  {
    section: 'reports',
    ar: 'ما أرصدة الخزائن؟',
    en: 'What are vault balances?',
    shortAr: 'أرصدة الخزائن',
    shortEn: 'Vault balances',
    domain: canVaults,
  },
  {
    section: 'reports',
    ar: 'أعطني ملخص الربح والخسارة',
    en: 'Give me P&L summary',
    shortAr: 'ملخص الربح والخسارة',
    shortEn: 'P&L summary',
    domain: canReports,
  },
  {
    section: 'reports',
    ar: 'نسب الخارج على المبيعات (مشتريات، مصروفات، المجموع — حتى أمس)',
    en: 'Operating load vs sales: purchases %, expenses %, combined % (MTD through yesterday).',
    shortAr: 'نسب الخارج على المبيعات',
    shortEn: 'Load vs sales (MTD)',
    domain: (c) => canSales(c) && canInvoices(c) && canVaults(c),
  },
  {
    section: 'compare',
    ar: 'مبيعات الشهر الحالي مقابل الماضي (نفس الفترة)',
    en: 'This month vs last month sales (aligned partial months).',
    shortAr: 'مبيعات: الحالي vs الماضي',
    shortEn: 'Sales: this vs last month',
    domain: canSales,
  },
  {
    section: 'counts',
    ar: 'كم عدد الفواتير؟',
    en: 'How many invoices?',
    shortAr: 'عدد الفواتير',
    shortEn: 'Invoice count',
    domain: canInvoices,
  },
  {
    section: 'counts',
    ar: 'كم عدد الموردين؟',
    en: 'How many suppliers?',
    shortAr: 'عدد الموردين',
    shortEn: 'Supplier count',
    domain: canSuppliers,
  },
  {
    section: 'counts',
    ar: 'كم عدد الموظفين؟',
    en: 'How many employees?',
    shortAr: 'عدد الموظفين',
    shortEn: 'Employee count',
    domain: canEmployees,
  },
  { section: 'other', ar: 'مساعدة', en: 'Help', domain: () => true },
];

export const CMD_GROUPS: ChatCommandGroup[] = [
  {
    id: 'employees',
    labelAr: 'إدارة الموظفين',
    labelEn: 'Employee management',
    icon: '',
    items: [
      {
        key: 'addEmployee',
        labelAr: 'إضافة موظف',
        labelEn: 'Add employee',
        icon: '',
        canUse: (c) => (c(PERMISSIONS.HR_READ) || c(PERMISSIONS.EMPLOYEES_READ)) && c(PERMISSIONS.EMPLOYEES_WRITE),
      },
      {
        key: 'advance',
        labelAr: 'صرف سلفة',
        labelEn: 'Pay advance',
        icon: '',
        canUse: (c) =>
          c(PERMISSIONS.CHAT_PRESET_ADVANCES) || c(PERMISSIONS.HR_WRITE) || c(PERMISSIONS.EMPLOYEES_WRITE),
      },
      {
        key: 'increase',
        labelAr: 'زيادة / بدل',
        labelEn: 'Raise / Allowance',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_INCREASES) || c(PERMISSIONS.HR_WRITE),
      },
      {
        key: 'leave',
        labelAr: 'تسجيل إجازة',
        labelEn: 'Record leave',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_LEAVES) || c(PERMISSIONS.HR_WRITE),
      },
      {
        key: 'deduction',
        labelAr: 'تسجيل خصم',
        labelEn: 'Record deduction',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_DEDUCTIONS) || c(PERMISSIONS.HR_WRITE),
      },
    ],
  },
  {
    id: 'expenses',
    labelAr: 'المصاريف الثابتة',
    labelEn: 'Fixed expenses',
    icon: '',
    items: [
      {
        key: 'addExpenseLine',
        labelAr: 'إضافة مصاريف ثابتة',
        labelEn: 'Add fixed expenses',
        icon: '',
        canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE),
      },
      {
        key: 'payExpense',
        labelAr: 'سداد مصاريف ثابتة',
        labelEn: 'Payment of fixed expenses',
        icon: '',
        canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE),
      },
      {
        key: 'editExpenseLine',
        labelAr: 'تعديل مصاريف ثابتة',
        labelEn: 'Edit fixed expenses',
        icon: '',
        canUse: (c) => c(PERMISSIONS.EXPENSES_WRITE) || c(PERMISSIONS.INVOICES_WRITE),
      },
    ],
  },
];
