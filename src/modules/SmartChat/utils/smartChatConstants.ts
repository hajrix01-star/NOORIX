/**
 * ثوابت المحادثة: أسئلة جاهزة + مجموعات الأوامر
 *
 * إجابات «الأسئلة الجاهزة» (PERMANENT_QUESTIONS) تُصدَّر من المعالجات كـ: عنوان ## ثم جدول
 * بفاصل Tab (عمودان على الأقل) ليعرضها SmartChatReportCard كجدول HTML — لا يُستنتج الجدول تلقائياً من الأرقام وحدها.
 */
import { PERMISSIONS } from '../../../constants/permissions';
import type { ChatCommandGroup, PermanentQuestion, PermissionChecker } from '../types';
import { canUseFaqQuestion } from './smartChatFaqAccess';

export const CHAT_PAGE_SIZE = 6;

const canSales = (c: PermissionChecker) => c(PERMISSIONS.VIEW_SALES) || c(PERMISSIONS.SALES_READ);
const canVaults = (c: PermissionChecker) => c(PERMISSIONS.VIEW_VAULTS) || c(PERMISSIONS.VAULTS_READ);
const canReports = (c: PermissionChecker) => c(PERMISSIONS.VIEW_REPORTS) || c(PERMISSIONS.REPORTS_READ);
const canInvoices = (c: PermissionChecker) => c(PERMISSIONS.VIEW_INVOICES) || c(PERMISSIONS.INVOICES_READ);
const canSuppliers = (c: PermissionChecker) => c(PERMISSIONS.VIEW_SUPPLIERS) || c(PERMISSIONS.SUPPLIERS_READ);
const canEmployees = (c: PermissionChecker) => c(PERMISSIONS.VIEW_EMPLOYEES) || c(PERMISSIONS.EMPLOYEES_READ);

export const PERMANENT_QUESTIONS: PermanentQuestion[] = [
  {
    key: 'annualSales',
    section: 'reports',
    ar: 'كم مبيعات السنة؟',
    en: 'What are annual sales?',
    shortAr: 'مبيعات السنة',
    shortEn: 'Annual sales',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_ANNUAL_SALES, canSales),
  },
  {
    key: 'vaultBalances',
    section: 'reports',
    ar: 'ما أرصدة الخزائن؟',
    en: 'What are vault balances?',
    shortAr: 'أرصدة الخزائن',
    shortEn: 'Vault balances',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_VAULT_BALANCES, canVaults),
  },
  {
    key: 'pnlSummary',
    section: 'reports',
    ar: 'أعطني ملخص الربح والخسارة',
    en: 'Give me P&L summary',
    shortAr: 'ملخص الربح والخسارة',
    shortEn: 'P&L summary',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_PNL_SUMMARY, canReports),
  },
  {
    key: 'loadVsSales',
    section: 'reports',
    ar: 'نسب الخارج على المبيعات (مشتريات، مصروفات، المجموع — حتى أمس)',
    en: 'Operating load vs sales: purchases %, expenses %, combined % (MTD through yesterday).',
    shortAr: 'نسب الخارج على المبيعات',
    shortEn: 'Load vs sales (MTD)',
    canUse: (c) =>
      canUseFaqQuestion(
        c,
        PERMISSIONS.CHAT_FAQ_LOAD_VS_SALES,
        (x) => canSales(x) && canInvoices(x) && canVaults(x),
      ),
  },
  {
    key: 'salesCompare',
    section: 'compare',
    ar: 'مبيعات الشهر الحالي مقابل الماضي (نفس الفترة)',
    en: 'This month vs last month sales (aligned partial months).',
    shortAr: 'مبيعات: الحالي vs الماضي',
    shortEn: 'Sales: this vs last month',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_SALES_COMPARE, canSales),
  },
  {
    key: 'invoiceCount',
    section: 'counts',
    ar: 'كم عدد الفواتير؟',
    en: 'How many invoices?',
    shortAr: 'عدد الفواتير',
    shortEn: 'Invoice count',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_INVOICE_COUNT, canInvoices),
  },
  {
    key: 'supplierCount',
    section: 'counts',
    ar: 'كم عدد الموردين؟',
    en: 'How many suppliers?',
    shortAr: 'عدد الموردين',
    shortEn: 'Supplier count',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_SUPPLIER_COUNT, canSuppliers),
  },
  {
    key: 'employeeCount',
    section: 'counts',
    ar: 'كم عدد الموظفين؟',
    en: 'How many employees?',
    shortAr: 'عدد الموظفين',
    shortEn: 'Employee count',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_EMPLOYEE_COUNT, canEmployees),
  },
  {
    key: 'help',
    section: 'other',
    ar: 'مساعدة',
    en: 'Help',
    canUse: (c) => canUseFaqQuestion(c, PERMISSIONS.CHAT_FAQ_HELP, () => true),
  },
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
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_ADD_EMPLOYEE),
      },
      {
        key: 'advance',
        labelAr: 'صرف سلفة',
        labelEn: 'Pay advance',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_ADVANCES),
      },
      {
        key: 'increase',
        labelAr: 'زيادة / بدل',
        labelEn: 'Raise / Allowance',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_INCREASES),
      },
      {
        key: 'leave',
        labelAr: 'تسجيل إجازة',
        labelEn: 'Record leave',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_LEAVES),
      },
      {
        key: 'deduction',
        labelAr: 'تسجيل خصم',
        labelEn: 'Record deduction',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_DEDUCTIONS),
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
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_EXPENSE_ADD),
      },
      {
        key: 'payExpense',
        labelAr: 'سداد مصاريف ثابتة',
        labelEn: 'Payment of fixed expenses',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_EXPENSE_PAY),
      },
      {
        key: 'editExpenseLine',
        labelAr: 'تعديل مصاريف ثابتة',
        labelEn: 'Edit fixed expenses',
        icon: '',
        canUse: (c) => c(PERMISSIONS.CHAT_PRESET_EXPENSE_EDIT),
      },
    ],
  },
];
