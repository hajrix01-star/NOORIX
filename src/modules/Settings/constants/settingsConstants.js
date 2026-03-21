/** ثوابت مشتركة لشاشة الإعدادات */

export const PERMISSION_LABELS = {
  VIEW_OWNER:         { ar: 'عرض لوحة المالك',        icon: '👑', group: 'عرض الأقسام' },
  VIEW_DASHBOARD:     { ar: 'عرض لوحة التحكم',        icon: '🏠', group: 'عرض الأقسام' },
  VIEW_CHAT:          { ar: 'عرض المحادثة الذكية',    icon: '💬', group: 'عرض الأقسام' },
  VIEW_SALES:         { ar: 'عرض المبيعات',           icon: '🛒', group: 'عرض الأقسام' },
  VIEW_INVOICES:      { ar: 'عرض الفواتير',           icon: '🧾', group: 'عرض الأقسام' },
  VIEW_SUPPLIERS:     { ar: 'عرض الموردين',           icon: '🚚', group: 'عرض الأقسام' },
  VIEW_VAULTS:        { ar: 'عرض الخزائن',            icon: '🏦', group: 'عرض الأقسام' },
  VIEW_REPORTS:       { ar: 'عرض التقارير',           icon: '📈', group: 'عرض الأقسام' },
  INVOICES_READ:      { ar: 'قراءة الفواتير',         icon: '👁️', group: 'الفواتير'    },
  INVOICES_WRITE:     { ar: 'كتابة / تعديل الفواتير', icon: '✏️', group: 'الفواتير'    },
  INVOICES_DELETE:    { ar: 'حذف الفواتير',           icon: '🗑️', group: 'الفواتير'    },
  SALES_READ:         { ar: 'قراءة المبيعات',         icon: '👁️', group: 'المبيعات'    },
  SALES_WRITE:        { ar: 'كتابة / تعديل المبيعات', icon: '✏️', group: 'المبيعات'    },
  SALES_DELETE:       { ar: 'حذف المبيعات',           icon: '🗑️', group: 'المبيعات'    },
  SUPPLIERS_READ:     { ar: 'قراءة الموردين',          icon: '👁️', group: 'الموردين'    },
  SUPPLIERS_WRITE:    { ar: 'إضافة / تعديل الموردين', icon: '✏️', group: 'الموردين'    },
  SUPPLIERS_DELETE:   { ar: 'حذف الموردين',           icon: '🗑️', group: 'الموردين'    },
  VAULTS_READ:        { ar: 'قراءة الخزائن',          icon: '👁️', group: 'الخزائن'     },
  VAULTS_WRITE:       { ar: 'إضافة / تعديل الخزائن', icon: '✏️', group: 'الخزائن'     },
  VAULTS_DELETE:      { ar: 'حذف الخزائن',            icon: '🗑️', group: 'الخزائن'     },
  REPORTS_READ:       { ar: 'قراءة التقارير',          icon: '👁️', group: 'التقارير'    },
  MANAGE_SETTINGS:    { ar: 'إدارة الإعدادات',         icon: '⚙️', group: 'إدارة النظام'},
  MANAGE_COMPANIES:   { ar: 'إدارة الشركات',           icon: '🏢', group: 'إدارة النظام'},
  MANAGE_USERS:       { ar: 'إدارة المستخدمين',        icon: '👥', group: 'إدارة النظام'},
  DELETE_COMPANY:     { ar: 'حذف الشركات',            icon: '💥', group: 'عمليات خطرة' },
  USERS_DELETE:       { ar: 'حذف المستخدمين',          icon: '💥', group: 'عمليات خطرة' },
  CREATE_INVOICE:     { ar: 'إنشاء فاتورة',           icon: '📝', group: 'الفواتير'    },
  SMART_CHAT_READ:    { ar: 'استخدام المحادثة الذكية', icon: '🤖', group: 'المحادثة'    },
  CHAT_PRESET_ADVANCES:  { ar: 'محادثة: أمر سريع — سلف',     icon: '⚡', group: 'المحادثة' },
  CHAT_PRESET_LEAVES:    { ar: 'محادثة: أمر سريع — إجازات', icon: '⚡', group: 'المحادثة' },
  CHAT_PRESET_DEDUCTIONS:{ ar: 'محادثة: أمر سريع — خصومات', icon: '⚡', group: 'المحادثة' },
  CHAT_PRESET_FAQ:       { ar: 'محادثة: الأسئلة الجاهزة',   icon: '❓', group: 'المحادثة' },
};

export const ALL_PERMISSIONS_LIST = Object.keys(PERMISSION_LABELS);

export const ROLE_COLORS = ['#f59e0b','#38bdf8','#22c55e','#a855f7','#ef4444','#f97316','#14b8a6'];
export const getRoleColor = (idx) => ROLE_COLORS[idx % ROLE_COLORS.length];

export const ROLE_OPTIONS = [
  { value: 'accountant', label: 'محاسب'         },
  { value: 'cashier',    label: 'كاشير'          },
  { value: 'owner',      label: 'مالك النظام'    },
];

export const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)',
};
export const labelStyle = { display: 'block', marginBottom: 4, fontSize: 14 };

export const DELETE_CODE_KEY     = 'noorix-delete-code';
export const DEFAULT_DELETE_CODE = '123';

export function getDeleteCode() {
  try   { return localStorage.getItem(DELETE_CODE_KEY) || DEFAULT_DELETE_CODE; }
  catch { return DEFAULT_DELETE_CODE; }
}
export function setDeleteCode(value) {
  try { localStorage.setItem(DELETE_CODE_KEY, value || DEFAULT_DELETE_CODE); }
  catch (_) {}
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
