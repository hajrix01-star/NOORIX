/**
 * Noorix Permissions — مصدر الحقيقة الوحيد لكل الصلاحيات.
 *
 * ✅ الصلاحيات تُعرّف هنا فقط — الـ frontend يجلبها عبر API.
 * ✅ الأدوار النظامية تُزرع في DB عند أول تشغيل — لا fallback.
 * ✅ hasPermission يتحقق من DB فقط — بسيط ومتوقع.
 */

// ── قائمة الصلاحيات ──────────────────────────────────

export const PERMISSIONS = {
  VIEW_OWNER:       'VIEW_OWNER',
  VIEW_DASHBOARD:   'VIEW_DASHBOARD',
  VIEW_CHAT:        'VIEW_CHAT',
  VIEW_SALES:       'VIEW_SALES',
  VIEW_INVOICES:    'VIEW_INVOICES',
  VIEW_SUPPLIERS:   'VIEW_SUPPLIERS',
  VIEW_VAULTS:      'VIEW_VAULTS',
  VIEW_REPORTS:     'VIEW_REPORTS',
  VIEW_EMPLOYEES:   'VIEW_EMPLOYEES',
  VIEW_ORDERS:      'VIEW_ORDERS',
  VIEW_EXPENSES:    'VIEW_EXPENSES',

  INVOICES_READ:    'INVOICES_READ',
  INVOICES_WRITE:   'INVOICES_WRITE',
  INVOICES_DELETE:  'INVOICES_DELETE',
  INVOICES_ACTIONS: 'INVOICES_ACTIONS',

  VIEW_PURCHASES:    'VIEW_PURCHASES',
  PURCHASES_READ:    'PURCHASES_READ',
  PURCHASES_WRITE:   'PURCHASES_WRITE',
  PURCHASES_DELETE:  'PURCHASES_DELETE',

  SALES_READ:       'SALES_READ',
  SALES_WRITE:      'SALES_WRITE',
  SALES_DELETE:     'SALES_DELETE',
  SALES_ACTIONS:    'SALES_ACTIONS',
  SALES_FULL_HISTORY:        'SALES_FULL_HISTORY',
  SALES_VIEW_SUMMARIES_LIST: 'SALES_VIEW_SUMMARIES_LIST',

  SUPPLIERS_READ:   'SUPPLIERS_READ',
  SUPPLIERS_WRITE:  'SUPPLIERS_WRITE',
  SUPPLIERS_DELETE: 'SUPPLIERS_DELETE',

  VAULTS_READ:      'VAULTS_READ',
  VAULTS_WRITE:     'VAULTS_WRITE',
  VAULTS_DELETE:    'VAULTS_DELETE',

  EXPENSES_READ:    'EXPENSES_READ',
  EXPENSES_WRITE:   'EXPENSES_WRITE',
  EXPENSES_DELETE:  'EXPENSES_DELETE',

  ORDERS_READ:      'ORDERS_READ',
  ORDERS_WRITE:     'ORDERS_WRITE',
  ORDERS_DELETE:    'ORDERS_DELETE',

  REPORTS_READ:     'REPORTS_READ',

  SMART_CHAT_READ:  'SMART_CHAT_READ',

  CHAT_PRESET_ADVANCES:  'CHAT_PRESET_ADVANCES',
  CHAT_PRESET_LEAVES:    'CHAT_PRESET_LEAVES',
  CHAT_PRESET_DEDUCTIONS:'CHAT_PRESET_DEDUCTIONS',
  CHAT_PRESET_FAQ:       'CHAT_PRESET_FAQ',
  CHAT_PRESET_INCREASES: 'CHAT_PRESET_INCREASES',

  EMPLOYEES_READ:   'EMPLOYEES_READ',
  EMPLOYEES_WRITE:  'EMPLOYEES_WRITE',
  EMPLOYEES_DELETE: 'EMPLOYEES_DELETE',

  HR_READ:          'HR_READ',
  HR_WRITE:         'HR_WRITE',
  HR_DELETE:        'HR_DELETE',

  MANAGE_SETTINGS:  'MANAGE_SETTINGS',
  MANAGE_COMPANIES: 'MANAGE_COMPANIES',
  MANAGE_USERS:     'MANAGE_USERS',

  DELETE_COMPANY:   'DELETE_COMPANY',
  USERS_DELETE:     'USERS_DELETE',

  CREATE_INVOICE:   'CREATE_INVOICE',

  VIEW_OCR:   'VIEW_OCR',
  OCR_READ:   'OCR_READ',
  OCR_WRITE:  'OCR_WRITE',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ── الأدوار النظامية ──────────────────────────────────

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER:       'owner',
  ACCOUNTANT:  'accountant',
  CASHIER:     'cashier',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// ── مصفوفة الأقسام (تُرسل للـ frontend عبر API) ──────

export interface PermissionModule {
  key: string;
  labelAr: string;
  labelEn: string;
  icon: string;
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
    key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', icon: '🛒',
    permissions: {
      view: 'VIEW_SALES', read: 'SALES_READ', write: 'SALES_WRITE', delete: 'SALES_DELETE',
      actions: 'SALES_ACTIONS', history: 'SALES_FULL_HISTORY', list: 'SALES_VIEW_SUMMARIES_LIST',
    },
  },
  {
    key: 'invoices', labelAr: 'فواتير المبيعات', labelEn: 'Sales Invoices', icon: '🧾',
    permissions: {
      view: 'VIEW_INVOICES', read: 'INVOICES_READ', write: 'INVOICES_WRITE', delete: 'INVOICES_DELETE',
      actions: 'INVOICES_ACTIONS', create: 'CREATE_INVOICE',
    },
  },
  {
    key: 'purchases', labelAr: 'المشتريات', labelEn: 'Purchases', icon: '🛍️',
    permissions: {
      view: 'VIEW_PURCHASES', read: 'PURCHASES_READ', write: 'PURCHASES_WRITE', delete: 'PURCHASES_DELETE',
    },
  },
  {
    key: 'suppliers', labelAr: 'الموردين والتصنيفات', labelEn: 'Suppliers & Categories', icon: '🚚',
    permissions: { view: 'VIEW_SUPPLIERS', read: 'SUPPLIERS_READ', write: 'SUPPLIERS_WRITE', delete: 'SUPPLIERS_DELETE' },
  },
  {
    key: 'vaults', labelAr: 'الخزائن', labelEn: 'Vaults (Treasury)', icon: '💰',
    permissions: { view: 'VIEW_VAULTS', read: 'VAULTS_READ', write: 'VAULTS_WRITE', delete: 'VAULTS_DELETE' },
  },
  {
    key: 'expenses', labelAr: 'المصروفات', labelEn: 'Expenses', icon: '💸',
    permissions: { view: 'VIEW_EXPENSES', read: 'EXPENSES_READ', write: 'EXPENSES_WRITE', delete: 'EXPENSES_DELETE' },
  },
  {
    key: 'orders', labelAr: 'الطلبات', labelEn: 'Orders', icon: '📦',
    permissions: { view: 'VIEW_ORDERS', read: 'ORDERS_READ', write: 'ORDERS_WRITE', delete: 'ORDERS_DELETE' },
  },
  {
    key: 'employees', labelAr: 'الموظفين', labelEn: 'Employees', icon: '👥',
    permissions: { view: 'VIEW_EMPLOYEES', read: 'EMPLOYEES_READ', write: 'EMPLOYEES_WRITE', delete: 'EMPLOYEES_DELETE' },
  },
  {
    key: 'hr', labelAr: 'الموارد البشرية (رواتب، إجازات)', labelEn: 'HR (Payroll, Leaves)', icon: '🏢',
    permissions: { read: 'HR_READ', write: 'HR_WRITE', delete: 'HR_DELETE' },
  },
  {
    key: 'reports', labelAr: 'التقارير', labelEn: 'Reports', icon: '📈',
    permissions: { view: 'VIEW_REPORTS', read: 'REPORTS_READ' },
  },
  {
    key: 'chat', labelAr: 'المحادثة الذكية', labelEn: 'Smart Chat', icon: '💬',
    permissions: {
      view: 'VIEW_CHAT', read: 'SMART_CHAT_READ',
      chatAdv: 'CHAT_PRESET_ADVANCES', chatLeave: 'CHAT_PRESET_LEAVES',
      chatDed: 'CHAT_PRESET_DEDUCTIONS', chatFaq: 'CHAT_PRESET_FAQ', chatInc: 'CHAT_PRESET_INCREASES',
    },
  },
  {
    key: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', icon: '⚙️',
    permissions: { view: 'MANAGE_SETTINGS' },
  },
  {
    key: 'users', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: '🔐',
    permissions: { read: 'MANAGE_USERS', delete: 'USERS_DELETE' },
  },
  {
    key: 'companies', labelAr: 'إدارة الشركات', labelEn: 'Company Management', icon: '🏗️',
    permissions: { write: 'MANAGE_COMPANIES', delete: 'DELETE_COMPANY' },
  },
  {
    key: 'ocr', labelAr: 'OCR الفواتير (تجريبي)', labelEn: 'OCR Invoices (Beta)', icon: '🔍',
    permissions: { view: 'VIEW_OCR', read: 'OCR_READ', write: 'OCR_WRITE' },
  },
];

export const PERMISSION_LEVELS: Record<string, { ar: string; en: string }> = {
  view:       { ar: 'عرض الصفحة', en: 'View Page' },
  read:       { ar: 'قراءة البيانات', en: 'Read Data' },
  write:      { ar: 'إنشاء وتعديل', en: 'Create & Edit' },
  delete:     { ar: 'حذف', en: 'Delete' },
  actions:    { ar: 'إجراءات', en: 'Actions' },
  create:     { ar: 'إنشاء فاتورة', en: 'Create Invoice' },
  history:    { ar: 'التاريخ الكامل', en: 'Full History' },
  list:       { ar: 'قائمة الملخصات', en: 'Summaries List' },
  chatAdv:    { ar: 'محادثة · سلف', en: 'Chat · Advances' },
  chatLeave:  { ar: 'محادثة · إجازات', en: 'Chat · Leaves' },
  chatDed:    { ar: 'محادثة · خصومات', en: 'Chat · Deductions' },
  chatFaq:    { ar: 'محادثة · أسئلة', en: 'Chat · FAQ' },
  chatInc:    { ar: 'محادثة · زيادات', en: 'Chat · Raises' },
};

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
      PERMISSIONS.VIEW_SALES, PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.VIEW_ORDERS,
      PERMISSIONS.VIEW_EXPENSES,
      PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE, PERMISSIONS.INVOICES_ACTIONS,
      // صلاحيات المشتريات المنفصلة
      PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.PURCHASES_READ, PERMISSIONS.PURCHASES_WRITE, PERMISSIONS.PURCHASES_DELETE,
      PERMISSIONS.SALES_READ, PERMISSIONS.SALES_WRITE, PERMISSIONS.SALES_ACTIONS,
      PERMISSIONS.SALES_FULL_HISTORY, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      PERMISSIONS.SUPPLIERS_READ, PERMISSIONS.VAULTS_READ,
      PERMISSIONS.EXPENSES_READ, PERMISSIONS.EXPENSES_WRITE,
      PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_WRITE, PERMISSIONS.REPORTS_READ,
      PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_WRITE,
      PERMISSIONS.HR_READ, PERMISSIONS.HR_WRITE, PERMISSIONS.HR_DELETE,
      PERMISSIONS.SMART_CHAT_READ, PERMISSIONS.CHAT_PRESET_ADVANCES,
      PERMISSIONS.CHAT_PRESET_LEAVES, PERMISSIONS.CHAT_PRESET_DEDUCTIONS,
      PERMISSIONS.CHAT_PRESET_FAQ, PERMISSIONS.CHAT_PRESET_INCREASES,
      PERMISSIONS.CREATE_INVOICE,
    ],
  },
  [ROLES.CASHIER]: {
    nameAr: 'الكاشير',
    permissions: [
      PERMISSIONS.VIEW_CHAT, PERMISSIONS.VIEW_SALES, PERMISSIONS.VIEW_INVOICES,
      PERMISSIONS.SALES_READ, PERMISSIONS.SALES_WRITE, PERMISSIONS.SALES_ACTIONS,
      PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE, PERMISSIONS.INVOICES_ACTIONS,
      // الكاشير: عرض المشتريات فقط (بدون تعديل/حذف)
      PERMISSIONS.VIEW_PURCHASES, PERMISSIONS.PURCHASES_READ,
      PERMISSIONS.SMART_CHAT_READ, PERMISSIONS.CHAT_PRESET_FAQ,
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
