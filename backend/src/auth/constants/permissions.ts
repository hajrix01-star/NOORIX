/**
 * Noorix Permissions — مصدر الحقيقة الوحيد لكل الصلاحيات.
 *
 * ✅ الصلاحيات تُعرّف هنا فقط — الـ frontend يجلبها عبر API.
 * ✅ الأدوار النظامية تُزرع في DB عند أول تشغيل — لا fallback.
 * ✅ hasPermission يتحقق من DB فقط — بسيط ومتوقع.
 */

import { CHAT_FAQ_PERMISSIONS, PERMISSIONS, ROLES } from '@noorix/permissions-core';
import type { Permission, RoleName } from '@noorix/permissions-core';

export { CHAT_FAQ_PERMISSIONS, PERMISSIONS, ROLES };
export type { Permission, RoleName };

// ── مصفوفة الأقسام (تُرسل للـ frontend عبر API) ──────

export interface PermissionModule {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  /** تجميع عرضي فقط في محرّر الأدوار؛ لا يدخل في التخزين أو التحقق من الصلاحيات. */
  group?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  permissions: Record<string, string>;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', icon: '📊',
    permissions: { view: 'VIEW_DASHBOARD' },
  },
  {
    key: 'ownerDashboard', labelAr: 'لوحة المالك', labelEn: 'Owner Dashboard', icon: '👑',
    permissions: { view: 'VIEW_OWNER' },
  },
  {
    key: 'sales', labelAr: 'المبيعات اليومية', labelEn: 'Daily Sales', icon: '🛒',
    permissions: {
      view: 'VIEW_SALES', read: 'SALES_READ', write: 'SALES_WRITE', delete: 'SALES_DELETE',
      actions: 'SALES_ACTIONS', history: 'SALES_FULL_HISTORY', list: 'SALES_VIEW_SUMMARIES_LIST',
    },
  },
  {
    key: 'invoices', labelAr: 'سجل الفواتير', labelEn: 'Invoice Register', icon: '🧾',
    descriptionAr: 'فواتير المشتريات والمصروفات والحركات المرتبطة بها.',
    descriptionEn: 'Purchase, expense, and related transaction invoices.',
    permissions: {
      view: 'VIEW_INVOICES', read: 'INVOICES_READ', write: 'INVOICES_WRITE', delete: 'INVOICES_DELETE',
      actions: 'INVOICES_ACTIONS', create: 'CREATE_INVOICE',
      summary: 'INVOICES_VIEW_EXEC_SUMMARY',
    },
  },
  {
    key: 'purchases', labelAr: 'المشتريات', labelEn: 'Purchases', icon: '🛍️',
    descriptionAr: 'إدخال المشتريات وإدارة بياناتها.',
    descriptionEn: 'Purchase entry and management.',
    permissions: {
      view: 'VIEW_PURCHASES', read: 'PURCHASES_READ', write: 'PURCHASES_WRITE', delete: 'PURCHASES_DELETE',
    },
  },
  {
    key: 'suppliers', labelAr: 'الموردون والتصنيفات', labelEn: 'Suppliers & Categories', icon: '🚚',
    permissions: { view: 'VIEW_SUPPLIERS', read: 'SUPPLIERS_READ', write: 'SUPPLIERS_WRITE', delete: 'SUPPLIERS_DELETE' },
  },
  {
    key: 'vaults', labelAr: 'الخزائن', labelEn: 'Vaults (Treasury)', icon: '💰',
    permissions: { view: 'VIEW_VAULTS', read: 'VAULTS_READ', write: 'VAULTS_WRITE', delete: 'VAULTS_DELETE' },
  },
  {
    key: 'expenses', labelAr: 'المصروفات والالتزامات', labelEn: 'Expenses & Obligations', icon: '💸',
    permissions: { view: 'VIEW_EXPENSES', read: 'EXPENSES_READ', write: 'EXPENSES_WRITE', delete: 'EXPENSES_DELETE' },
  },
  {
    key: 'assets', labelAr: 'سجل الأصول والضمان', labelEn: 'Assets & Warranty Register', icon: '🖥️',
    permissions: { view: 'VIEW_ASSETS', read: 'ASSETS_READ', write: 'ASSETS_WRITE', delete: 'ASSETS_DELETE' },
  },
  {
    key: 'ordersV4', labelAr: 'الطلبات', labelEn: 'Orders', icon: '📦',
    permissions: {
      view: 'VIEW_ORDERS_V4',
      read: 'ORDERS_V4_READ',
      write: 'ORDERS_V4_WRITE',
      delete: 'ORDERS_V4_DELETE',
      staffSubmit: 'ORDERS_V4_STAFF_SUBMIT',
      internalSubmit: 'ORDERS_V4_INTERNAL_SUBMIT',
      cashierReceive: 'ORDERS_V4_CASHIER_RECEIVE',
      reports: 'ORDERS_V4_REPORTS_READ',
      inventory: 'ORDERS_V4_INVENTORY_WRITE',
    },
  },
  {
    key: 'employees', labelAr: 'بيانات الموظفين', labelEn: 'Employee Records', icon: '👥', group: 'humanResources',
    permissions: { view: 'VIEW_EMPLOYEES', read: 'EMPLOYEES_READ', write: 'EMPLOYEES_WRITE', delete: 'EMPLOYEES_DELETE' },
  },
  {
    key: 'hr', labelAr: 'عمليات الموارد البشرية', labelEn: 'HR Operations', icon: '🏢', group: 'humanResources',
    descriptionAr: 'الرواتب والإجازات والسلف والخصومات والتسويات.',
    descriptionEn: 'Payroll, leaves, advances, deductions, and settlements.',
    permissions: { view: 'VIEW_HR', read: 'HR_READ', write: 'HR_WRITE', delete: 'HR_DELETE', leaveSalaryOverride: 'HR_LEAVE_SALARY_OVERRIDE' },
  },
  {
    key: 'reports', labelAr: 'التقارير', labelEn: 'Reports', icon: '📈', group: 'reportsAndTax',
    permissions: {
      view: 'VIEW_REPORTS',
      read: 'REPORTS_READ',
      general: 'VIEW_REPORTS_GENERAL',
      costApps: 'VIEW_REPORTS_COST_APPS',
      taxReport: 'VIEW_REPORTS_TAX',
      bankStatement: 'VIEW_REPORTS_BANK',
    },
  },
  {
    key: 'hajriTax', labelAr: 'HAJRI TAX — السجل الضريبي', labelEn: 'HAJRI TAX — Tax Registry', icon: '📋', group: 'reportsAndTax',
    permissions: { view: 'VIEW_HAJRI_TAX', read: 'HAJRI_TAX_READ', write: 'HAJRI_TAX_WRITE' },
  },
  {
    key: 'chat', labelAr: 'المحادثة الذكية', labelEn: 'Smart Chat', icon: '💬',
    permissions: {
      view: 'VIEW_CHAT', read: 'SMART_CHAT_READ',
      chatAdv: 'CHAT_PRESET_ADVANCES', chatLeave: 'CHAT_PRESET_LEAVES',
      chatDed: 'CHAT_PRESET_DEDUCTIONS', chatFaq: 'CHAT_PRESET_FAQ', chatInc: 'CHAT_PRESET_INCREASES',
      chatEmp: 'CHAT_PRESET_ADD_EMPLOYEE',
      chatExpAdd: 'CHAT_PRESET_EXPENSE_ADD', chatExpPay: 'CHAT_PRESET_EXPENSE_PAY',
      chatExpEdit: 'CHAT_PRESET_EXPENSE_EDIT',
      faqSalesYear: 'CHAT_FAQ_ANNUAL_SALES', faqVaults: 'CHAT_FAQ_VAULT_BALANCES',
      faqPnl: 'CHAT_FAQ_PNL_SUMMARY', faqLoadSales: 'CHAT_FAQ_LOAD_VS_SALES',
      faqCompare: 'CHAT_FAQ_SALES_COMPARE', faqInvCount: 'CHAT_FAQ_INVOICE_COUNT',
      faqSupCount: 'CHAT_FAQ_SUPPLIER_COUNT', faqEmpCount: 'CHAT_FAQ_EMPLOYEE_COUNT',
      faqHelp: 'CHAT_FAQ_HELP',
    },
  },
  {
    key: 'settings', labelAr: 'إعدادات النظام', labelEn: 'System Settings', icon: '⚙️', group: 'settings',
    descriptionAr: 'الأدوار والصلاحيات والنسخ الاحتياطي وتكامل الذكاء الاصطناعي وهوية التطبيق.',
    descriptionEn: 'Roles, permissions, backup, AI integration, and app branding.',
    permissions: { view: 'MANAGE_SETTINGS' },
  },
  {
    key: 'users', labelAr: 'المستخدمون', labelEn: 'Users', icon: '🔐', group: 'settings',
    permissions: { read: 'MANAGE_USERS', delete: 'USERS_DELETE' },
  },
  {
    key: 'companies', labelAr: 'إدارة الشركات وإعدادات الضريبة', labelEn: 'Companies & Tax Settings', icon: '🏗️', group: 'settings',
    permissions: { write: 'MANAGE_COMPANIES', taxSettings: 'MANAGE_TAX_SETTINGS', delete: 'DELETE_COMPANY' },
  },
];

export const PERMISSION_LEVELS: Record<string, { ar: string; en: string }> = {
  view:       { ar: 'عرض الصفحة', en: 'View Page' },
  read:       { ar: 'قراءة البيانات', en: 'Read Data' },
  write:      { ar: 'إنشاء وتعديل', en: 'Create & Edit' },
  taxSettings:{ ar: 'إدارة إعدادات الضريبة', en: 'Manage tax settings' },
  delete:     { ar: 'حذف', en: 'Delete' },
  leaveSalaryOverride: { ar: 'تعديل مبلغ تسوية راتب الإجازة', en: 'Override leave salary settlement' },
  actions:    { ar: 'إجراءات', en: 'Actions' },
  create:     { ar: 'إنشاء فاتورة', en: 'Create Invoice' },
  history:    { ar: 'التاريخ الكامل', en: 'Full History' },
  list:       { ar: 'قائمة الملخصات', en: 'Summaries List' },
  summary:    { ar: 'كروت الداخل/الخارج', en: 'In/Out summary cards' },
  general:    { ar: 'التقرير العام', en: 'General report' },
  costApps:   { ar: 'حاسبة التكاليف والتطبيقات', en: 'Cost calculator & apps' },
  taxReport:  { ar: 'الضرائب', en: 'Taxes' },
  bankStatement: { ar: 'تحليل كشف الحسابات', en: 'Bank statement analysis' },
  submit:     { ar: 'تسجيل/إرسال', en: 'Submit' },
  staffSubmit: { ar: 'إرسال طلب قسم', en: 'Submit department order' },
  internalView: { ar: 'عرض التسجيل الداخلي', en: 'View internal registration' },
  internalRead: { ar: 'قراءة التسجيل الداخلي', en: 'Read internal registration' },
  internalSubmit: { ar: 'تسجيل داخلي', en: 'Submit internal registration' },
  cashierReceive: { ar: 'استلام الطلب وتعديله', en: 'Receive and edit order' },
  reports: { ar: 'قراءة التقارير', en: 'Read reports' },
  inventory: { ar: 'إدارة المخزون والجرد', en: 'Manage inventory and stocktakes' },
  chatAdv:    { ar: 'محادثة · سلف', en: 'Chat · Advances' },
  chatLeave:  { ar: 'محادثة · إجازات', en: 'Chat · Leaves' },
  chatDed:    { ar: 'محادثة · خصومات', en: 'Chat · Deductions' },
  chatFaq:    { ar: 'محادثة · أسئلة', en: 'Chat · FAQ' },
  chatInc:    { ar: 'محادثة · زيادات', en: 'Chat · Raises' },
  chatEmp:    { ar: 'محادثة · إضافة موظف', en: 'Chat · Add employee' },
  chatExpAdd: { ar: 'محادثة · إضافة مصروف ثابت', en: 'Chat · Add fixed expense' },
  chatExpPay: { ar: 'محادثة · سداد مصروف ثابت', en: 'Chat · Pay fixed expense' },
  chatExpEdit:{ ar: 'محادثة · تعديل مصروف ثابت', en: 'Chat · Edit fixed expense' },
  faqSalesYear: { ar: 'سؤال · مبيعات السنة', en: 'FAQ · Annual sales' },
  faqVaults:    { ar: 'سؤال · أرصدة الخزائن', en: 'FAQ · Vault balances' },
  faqPnl:       { ar: 'سؤال · ملخص الربح والخسارة', en: 'FAQ · P&L summary' },
  faqLoadSales: { ar: 'سؤال · نسب الخارج على المبيعات', en: 'FAQ · Load vs sales' },
  faqCompare:   { ar: 'سؤال · مقارنة المبيعات', en: 'FAQ · Sales compare' },
  faqInvCount:  { ar: 'سؤال · عدد الفواتير', en: 'FAQ · Invoice count' },
  faqSupCount:  { ar: 'سؤال · عدد الموردين', en: 'FAQ · Supplier count' },
  faqEmpCount:  { ar: 'سؤال · عدد الموظفين', en: 'FAQ · Employee count' },
  faqHelp:      { ar: 'سؤال · مساعدة', en: 'FAQ · Help' },
};

/** مجموعات العرض في محرّر الأدوار. لا تغيّر مفاتيح الصلاحيات أو الأدوار المخزنة. */
export const PERMISSION_MODULE_GROUPS = [
  { key: 'operations', labelAr: 'الأقسام التشغيلية', labelEn: 'Operations' },
  { key: 'humanResources', labelAr: 'الموارد البشرية وشؤون الموظفين', labelEn: 'Human Resources & Staff' },
  { key: 'reportsAndTax', labelAr: 'التقارير والضرائب', labelEn: 'Reports & Tax' },
  { key: 'settings', labelAr: 'الإعدادات والإدارة', labelEn: 'Settings & Administration' },
] as const;

for (const permissionModule of PERMISSION_MODULES) {
  permissionModule.group ||= 'operations';
}

// ── صلاحيات الأدوار النظامية (تُزرع في DB عند أول تشغيل) ──

const ALL = Object.values(PERMISSIONS) as string[];

export const SYSTEM_ROLE_SEEDS: Record<string, { nameAr: string; permissions: string[] }> = {
  [ROLES.OWNER]:       { nameAr: 'المالك', permissions: ALL },
  [ROLES.SUPER_ADMIN]: { nameAr: 'المشرف العام', permissions: ALL },
  [ROLES.ACCOUNTANT]:  {
    nameAr: 'المحاسب',
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_CHAT, PERMISSIONS.VIEW_INVOICES,
      PERMISSIONS.VIEW_SUPPLIERS, PERMISSIONS.VIEW_VAULTS, PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_SALES, PERMISSIONS.VIEW_EMPLOYEES,
      PERMISSIONS.VIEW_EXPENSES, PERMISSIONS.VIEW_ASSETS,
      PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE, PERMISSIONS.INVOICES_ACTIONS,
      PERMISSIONS.INVOICES_VIEW_EXEC_SUMMARY,
      // صلاحيات المشتريات المنفصلة
      PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.PURCHASES_READ, PERMISSIONS.PURCHASES_WRITE, PERMISSIONS.PURCHASES_DELETE,
      PERMISSIONS.SALES_READ, PERMISSIONS.SALES_WRITE, PERMISSIONS.SALES_ACTIONS,
      PERMISSIONS.SALES_FULL_HISTORY, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.VAULTS_READ,
      PERMISSIONS.EXPENSES_READ, PERMISSIONS.EXPENSES_WRITE,
      PERMISSIONS.ASSETS_READ, PERMISSIONS.ASSETS_WRITE,
      PERMISSIONS.VIEW_ORDERS_V4, PERMISSIONS.ORDERS_V4_READ, PERMISSIONS.ORDERS_V4_WRITE,
      PERMISSIONS.ORDERS_V4_CASHIER_RECEIVE, PERMISSIONS.ORDERS_V4_REPORTS_READ,
      PERMISSIONS.ORDERS_V4_INVENTORY_WRITE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.VIEW_REPORTS_GENERAL, PERMISSIONS.VIEW_REPORTS_COST_APPS,
      PERMISSIONS.VIEW_REPORTS_TAX, PERMISSIONS.VIEW_REPORTS_BANK,
      PERMISSIONS.VIEW_HAJRI_TAX, PERMISSIONS.HAJRI_TAX_READ, PERMISSIONS.HAJRI_TAX_WRITE,
      PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_WRITE,
      PERMISSIONS.VIEW_HR, PERMISSIONS.HR_READ, PERMISSIONS.HR_WRITE, PERMISSIONS.HR_DELETE,
      PERMISSIONS.HR_LEAVE_SALARY_OVERRIDE,
      PERMISSIONS.SMART_CHAT_READ, PERMISSIONS.CHAT_PRESET_ADVANCES,
      PERMISSIONS.CHAT_PRESET_LEAVES, PERMISSIONS.CHAT_PRESET_DEDUCTIONS,
      PERMISSIONS.CHAT_PRESET_INCREASES,
      PERMISSIONS.CHAT_PRESET_ADD_EMPLOYEE,
      PERMISSIONS.CHAT_PRESET_EXPENSE_ADD, PERMISSIONS.CHAT_PRESET_EXPENSE_PAY,
      PERMISSIONS.CHAT_PRESET_EXPENSE_EDIT,
      ...CHAT_FAQ_PERMISSIONS,
      PERMISSIONS.CREATE_INVOICE,
    ],
  },
  [ROLES.CASHIER]: {
    nameAr: 'الكاشير',
    permissions: [
      PERMISSIONS.VIEW_CHAT, PERMISSIONS.VIEW_SALES, PERMISSIONS.VIEW_INVOICES,
      PERMISSIONS.SALES_READ, PERMISSIONS.SALES_WRITE, PERMISSIONS.SALES_ACTIONS,
      /** يسمح بعرض ملخصات المبيعات والتقارير لأي تاريخ (بدون قصّ آخر 7 أيام). */
      PERMISSIONS.SALES_FULL_HISTORY,
      PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE, PERMISSIONS.INVOICES_ACTIONS,
      // الكاشير: عرض المشتريات فقط (بدون تعديل/حذف)
      PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.VIEW_ORDERS_V4, PERMISSIONS.ORDERS_V4_READ, PERMISSIONS.ORDERS_V4_CASHIER_RECEIVE,
      PERMISSIONS.SMART_CHAT_READ,
      PERMISSIONS.CHAT_FAQ_ANNUAL_SALES,
      PERMISSIONS.CHAT_FAQ_SALES_COMPARE,
      PERMISSIONS.CHAT_FAQ_INVOICE_COUNT,
      PERMISSIONS.CHAT_FAQ_HELP,
      PERMISSIONS.CREATE_INVOICE,
    ],
  },
};

// ── hasPermission — يتحقق من DB فقط (لا fallback) ──

export function hasPermission(_role: string, permission: Permission, userPermissions?: string[]): boolean {
  const r = (_role || '').toLowerCase();
  if (r === ROLES.SUPER_ADMIN || r === ROLES.OWNER) return true;
  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.includes(permission);
}

export function isSuperAdmin(role: string): boolean {
  const r = (role || '').toLowerCase();
  return r === ROLES.SUPER_ADMIN || r === ROLES.OWNER;
}

/** حذف مسيرة رواتب — المالك، المشرف العام (مدير النظام)، أو دور manager مخصّص */
export const PAYROLL_RUN_DELETE_ROLES = [
  ROLES.OWNER,
  ROLES.SUPER_ADMIN,
  'manager',
] as const;

const PAYROLL_RUN_DELETE_ROLE_SET = new Set<string>([...PAYROLL_RUN_DELETE_ROLES]);

export function canDeletePayrollRunRole(role: string | undefined): boolean {
  const r = (role || '').toLowerCase();
  return PAYROLL_RUN_DELETE_ROLE_SET.has(r);
}
