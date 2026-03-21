/**
 * صلاحيات Noorix — نظام صلاحيات متقدم قائم على الأقسام (Modules).
 * الصلاحيات تُقرأ من قاعدة البيانات عبر user.permissions — لا خريطة ثابتة.
 */

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

  SALES_READ:       'SALES_READ',
  SALES_WRITE:      'SALES_WRITE',
  SALES_DELETE:     'SALES_DELETE',
  SALES_ACTIONS:    'SALES_ACTIONS',

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

  CHAT_PRESET_ADVANCES:   'CHAT_PRESET_ADVANCES',
  CHAT_PRESET_LEAVES:     'CHAT_PRESET_LEAVES',
  CHAT_PRESET_DEDUCTIONS: 'CHAT_PRESET_DEDUCTIONS',
  CHAT_PRESET_FAQ:        'CHAT_PRESET_FAQ',

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
};

/**
 * مصفوفة الأقسام — لعرض الصلاحيات مجمّعة حسب الوحدة في واجهة الأدوار.
 * كل قسم يحتوي على: view (رؤية الصفحة), read, write, delete.
 */
export const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    labelAr: 'لوحة التحكم',
    labelEn: 'Dashboard',
    icon: '📊',
    permissions: {
      view:  'VIEW_DASHBOARD',
    },
  },
  {
    key: 'ownerDashboard',
    labelAr: 'لوحة المالك',
    labelEn: 'Owner Dashboard',
    icon: '👑',
    permissions: {
      view:  'VIEW_OWNER',
    },
  },
  {
    key: 'sales',
    labelAr: 'المبيعات',
    labelEn: 'Sales',
    icon: '🛒',
    permissions: {
      view:   'VIEW_SALES',
      read:   'SALES_READ',
      write:  'SALES_WRITE',
      delete: 'SALES_DELETE',
    },
  },
  {
    key: 'invoices',
    labelAr: 'المشتريات والفواتير',
    labelEn: 'Purchases & Invoices',
    icon: '📄',
    permissions: {
      view:   'VIEW_INVOICES',
      read:   'INVOICES_READ',
      write:  'INVOICES_WRITE',
      delete: 'INVOICES_DELETE',
    },
  },
  {
    key: 'suppliers',
    labelAr: 'الموردين والتصنيفات',
    labelEn: 'Suppliers & Categories',
    icon: '🚚',
    permissions: {
      view:   'VIEW_SUPPLIERS',
      read:   'SUPPLIERS_READ',
      write:  'SUPPLIERS_WRITE',
      delete: 'SUPPLIERS_DELETE',
    },
  },
  {
    key: 'vaults',
    labelAr: 'الخزائن',
    labelEn: 'Vaults (Treasury)',
    icon: '💰',
    permissions: {
      view:   'VIEW_VAULTS',
      read:   'VAULTS_READ',
      write:  'VAULTS_WRITE',
      delete: 'VAULTS_DELETE',
    },
  },
  {
    key: 'expenses',
    labelAr: 'المصروفات',
    labelEn: 'Expenses',
    icon: '💸',
    permissions: {
      view:   'VIEW_EXPENSES',
      read:   'EXPENSES_READ',
      write:  'EXPENSES_WRITE',
      delete: 'EXPENSES_DELETE',
    },
  },
  {
    key: 'orders',
    labelAr: 'الطلبات',
    labelEn: 'Orders',
    icon: '📦',
    permissions: {
      view:   'VIEW_ORDERS',
      read:   'ORDERS_READ',
      write:  'ORDERS_WRITE',
      delete: 'ORDERS_DELETE',
    },
  },
  {
    key: 'employees',
    labelAr: 'الموظفين',
    labelEn: 'Employees',
    icon: '👥',
    permissions: {
      view:   'VIEW_EMPLOYEES',
      read:   'EMPLOYEES_READ',
      write:  'EMPLOYEES_WRITE',
      delete: 'EMPLOYEES_DELETE',
    },
  },
  {
    key: 'hr',
    labelAr: 'الموارد البشرية (رواتب، إجازات)',
    labelEn: 'HR (Payroll, Leaves)',
    icon: '🏢',
    permissions: {
      read:   'HR_READ',
      write:  'HR_WRITE',
      delete: 'HR_DELETE',
    },
  },
  {
    key: 'reports',
    labelAr: 'التقارير',
    labelEn: 'Reports',
    icon: '📈',
    permissions: {
      view:  'VIEW_REPORTS',
      read:  'REPORTS_READ',
    },
  },
  {
    key: 'chat',
    labelAr: 'المحادثة الذكية',
    labelEn: 'Smart Chat',
    icon: '💬',
    permissions: {
      view:       'VIEW_CHAT',
      read:       'SMART_CHAT_READ',
      chatAdv:    'CHAT_PRESET_ADVANCES',
      chatLeave:  'CHAT_PRESET_LEAVES',
      chatDed:    'CHAT_PRESET_DEDUCTIONS',
      chatFaq:    'CHAT_PRESET_FAQ',
    },
  },
  {
    key: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    icon: '⚙️',
    permissions: {
      view:  'MANAGE_SETTINGS',
    },
  },
  {
    key: 'users',
    labelAr: 'إدارة المستخدمين',
    labelEn: 'User Management',
    icon: '🔐',
    permissions: {
      read:   'MANAGE_USERS',
      delete: 'USERS_DELETE',
    },
  },
  {
    key: 'companies',
    labelAr: 'إدارة الشركات',
    labelEn: 'Company Management',
    icon: '🏗️',
    permissions: {
      write:  'MANAGE_COMPANIES',
      delete: 'DELETE_COMPANY',
    },
  },
];

/** ترجمة أعمدة الصلاحيات */
export const PERMISSION_LEVELS = {
  view:       { ar: 'عرض الصفحة', en: 'View Page' },
  read:       { ar: 'قراءة البيانات', en: 'Read Data' },
  write:      { ar: 'إنشاء وتعديل', en: 'Create & Edit' },
  delete:     { ar: 'حذف', en: 'Delete' },
  chatAdv:    { ar: 'محادثة · سلف', en: 'Chat · Advances' },
  chatLeave:  { ar: 'محادثة · إجازات', en: 'Chat · Leaves' },
  chatDed:    { ar: 'محادثة · خصومات', en: 'Chat · Deductions' },
  chatFaq:    { ar: 'محادثة · أسئلة', en: 'Chat · FAQ' },
};

/**
 * hasPermission — يفحص الصلاحية من مصفوفة المستخدم (DB-based).
 * @param {string|string[]} roleOrPermissions - اسم الدور أو مصفوفة الصلاحيات
 * @param {string} permission - الصلاحية المطلوبة
 * @param {string[]} [userPermissions] - مصفوفة الصلاحيات (اختياري إذا مرّرت الدور)
 */
export function hasPermission(roleOrPermissions, permission, userPermissions) {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }

  const role = (roleOrPermissions || '').toLowerCase();
  if (role === 'super_admin' || role === 'owner') return true;

  if (Array.isArray(userPermissions)) {
    return userPermissions.includes(permission);
  }

  return false;
}

export function isSuperAdmin(role) {
  const r = (role || '').toLowerCase();
  return r === 'super_admin' || r === 'owner';
}

/** مسارات الصفحات → صلاحية مطلوبة (سلسلة واحدة أو عدة صلاحيات يكفي واحدة منها) */
export const ROUTE_PERMISSION = {
  '/owner':         PERMISSIONS.VIEW_OWNER,
  '/chat':          PERMISSIONS.VIEW_CHAT,
  '/sales':         PERMISSIONS.VIEW_SALES,
  '/sales/new':     PERMISSIONS.VIEW_SALES,
  '/invoices':      PERMISSIONS.VIEW_INVOICES,
  '/suppliers':     PERMISSIONS.VIEW_SUPPLIERS,
  '/treasury':      PERMISSIONS.VIEW_VAULTS,
  '/expenses':      PERMISSIONS.VIEW_EXPENSES,
  '/orders':        PERMISSIONS.VIEW_ORDERS,
  /** القائمة الجانبية تعتمد EMPLOYEES_READ؛ الحارس يقبل أيًا منهما لتفادي 403 عند الانتقال */
  '/hr':            [PERMISSIONS.VIEW_EMPLOYEES, PERMISSIONS.EMPLOYEES_READ],
  '/reports':       PERMISSIONS.VIEW_REPORTS,
  '/settings':      PERMISSIONS.MANAGE_SETTINGS,
  '/theme-preview': PERMISSIONS.VIEW_DASHBOARD,
};

export const REDIRECT_ONLY_PATHS = new Set([
  '/', '/purchasing', '/403',
]);

/**
 * صلاحيات المسار الحالي (بما فيه مسارات فرعية مثل /hr/employee/:id)
 */
export function getRouteRequiredPermissions(pathname) {
  if (REDIRECT_ONLY_PATHS.has(pathname)) return null;
  const direct = ROUTE_PERMISSION[pathname];
  if (direct != null) {
    return Array.isArray(direct) ? direct : [direct];
  }
  if (pathname.startsWith('/hr/')) {
    const hr = ROUTE_PERMISSION['/hr'];
    return Array.isArray(hr) ? hr : [hr];
  }
  return null;
}
