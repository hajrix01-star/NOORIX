/** ثوابت مشتركة لشاشة الإعدادات */

export const PERMISSION_LABELS = {
  VIEW_OWNER:         { ar: 'عرض لوحة المالك',        icon: 'V', group: 'عرض الأقسام' },
  VIEW_DASHBOARD:     { ar: 'عرض لوحة التحكم',        icon: 'V', group: 'عرض الأقسام' },
  VIEW_CHAT:          { ar: 'عرض المحادثة الذكية',    icon: 'V', group: 'عرض الأقسام' },
  VIEW_SALES:         { ar: 'عرض المبيعات',           icon: 'V', group: 'عرض الأقسام' },
  VIEW_INVOICES:      { ar: 'عرض الفواتير',           icon: 'V', group: 'عرض الأقسام' },
  VIEW_SUPPLIERS:     { ar: 'عرض الموردين',           icon: 'V', group: 'عرض الأقسام' },
  VIEW_VAULTS:        { ar: 'عرض الخزائن',            icon: 'V', group: 'عرض الأقسام' },
  VIEW_REPORTS:       { ar: 'عرض التقارير',           icon: 'V', group: 'عرض الأقسام' },
  INVOICES_READ:      { ar: 'قراءة الفواتير',         icon: 'R', group: 'الفواتير'    },
  INVOICES_WRITE:     { ar: 'كتابة / تعديل الفواتير', icon: 'W', group: 'الفواتير'    },
  INVOICES_DELETE:    { ar: 'حذف الفواتير',           icon: 'D', group: 'الفواتير'    },
  SALES_READ:         { ar: 'قراءة المبيعات',         icon: 'R', group: 'المبيعات'    },
  SALES_WRITE:        { ar: 'كتابة / تعديل المبيعات', icon: 'W', group: 'المبيعات'    },
  SALES_DELETE:       { ar: 'حذف المبيعات',           icon: 'D', group: 'المبيعات'    },
  SALES_FULL_HISTORY: { ar: 'المبيعات — عرض كامل السجل والفلاتر', icon: 'R', group: 'المبيعات' },
  SALES_VIEW_SUMMARIES_LIST: { ar: 'المبيعات — عرض جدول الملخصات السابقة', icon: 'R', group: 'المبيعات' },
  SUPPLIERS_READ:     { ar: 'قراءة الموردين',          icon: 'R', group: 'الموردين'    },
  SUPPLIERS_WRITE:    { ar: 'إضافة / تعديل الموردين', icon: 'W', group: 'الموردين'    },
  SUPPLIERS_DELETE:   { ar: 'حذف الموردين',           icon: 'D', group: 'الموردين'    },
  VAULTS_READ:        { ar: 'قراءة الخزائن',          icon: 'R', group: 'الخزائن'     },
  VAULTS_WRITE:       { ar: 'إضافة / تعديل الخزائن', icon: 'W', group: 'الخزائن'     },
  VAULTS_DELETE:      { ar: 'حذف الخزائن',            icon: 'D', group: 'الخزائن'     },
  REPORTS_READ:       { ar: 'قراءة التقارير',          icon: 'R', group: 'التقارير'    },
  MANAGE_SETTINGS:    { ar: 'إدارة الإعدادات',         icon: 'M', group: 'إدارة النظام'},
  MANAGE_COMPANIES:   { ar: 'إدارة الشركات',           icon: 'M', group: 'إدارة النظام'},
  MANAGE_USERS:       { ar: 'إدارة المستخدمين',        icon: 'M', group: 'إدارة النظام'},
  DELETE_COMPANY:     { ar: 'حذف الشركات',            icon: 'D', group: 'عمليات خطرة' },
  USERS_DELETE:       { ar: 'حذف المستخدمين',          icon: 'D', group: 'عمليات خطرة' },
  CREATE_INVOICE:     { ar: 'إنشاء فاتورة',           icon: 'W', group: 'الفواتير'    },
  SMART_CHAT_READ:    { ar: 'استخدام المحادثة الذكية', icon: 'R', group: 'المحادثة'    },
  CHAT_PRESET_ADVANCES:  { ar: 'محادثة: أمر سريع — سلف',     icon: 'P', group: 'المحادثة' },
  CHAT_PRESET_LEAVES:    { ar: 'محادثة: أمر سريع — إجازات', icon: 'P', group: 'المحادثة' },
  CHAT_PRESET_DEDUCTIONS:{ ar: 'محادثة: أمر سريع — خصومات', icon: 'P', group: 'المحادثة' },
  CHAT_PRESET_FAQ:       { ar: 'محادثة: الأسئلة الجاهزة',   icon: 'P', group: 'المحادثة' },
  CHAT_PRESET_INCREASES: { ar: 'محادثة: زيادات وبدلات',    icon: 'P', group: 'المحادثة' },
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
