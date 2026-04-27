/** بيانات البذر الافتراضي لدليل الحسابات (COA) */
export interface MasterAccountSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  icon: string;
  taxExempt: boolean;
}

export interface MasterVaultSeed {
  accountCode: string;
  nameAr: string;
  nameEn: string;
  type: 'cash' | 'bank';
}

export interface MasterCategorySeed {
  accountCode: string;
  nameAr: string;
  type: 'purchase' | 'expense' | 'sale';
}

/** قالب الحسابات الافتراضي — يُزرع لكل شركة جديدة */
export const MASTER_ACCOUNTS: MasterAccountSeed[] = [
  // أ- الأصول
  { code: 'V-001',  nameAr: 'نقد',                    nameEn: 'CASH',                        type: 'asset',   icon: '💵', taxExempt: false },
  { code: 'V-002',  nameAr: 'بنك',                    nameEn: 'BANK',                        type: 'asset',   icon: '💳', taxExempt: false },
  { code: 'AR-001', nameAr: 'الذمم المدينة (عملاء)',  nameEn: 'Accounts Receivable',         type: 'asset',   icon: '🧾', taxExempt: false },
  // ب- الخصوم
  { code: 'AP-001', nameAr: 'الذمم الدائنة (موردون)', nameEn: 'Accounts Payable',            type: 'liability',icon: '📋', taxExempt: false },
  { code: 'TAX-001',nameAr: 'ضريبة القيمة المضافة',   nameEn: 'VAT',                         type: 'liability',icon: '📝', taxExempt: false },
  // ج- حقوق الملكية
  { code: 'EQU-001',nameAr: 'رأس المال',              nameEn: 'Capital',                     type: 'equity',  icon: '💎', taxExempt: false },
  // د- الإيرادات
  { code: 'REV-001',nameAr: 'المبيعات',               nameEn: 'Sales',                       type: 'revenue', icon: '💰', taxExempt: false },
  // هـ- المصروفات / المشتريات
  { code: 'PUR-001',nameAr: 'مواد غذائية',             nameEn: 'Food & Materials',            type: 'expense', icon: '🥩', taxExempt: false },
  { code: 'PUR-002',nameAr: 'مشروبات',                 nameEn: 'Beverages',                   type: 'expense', icon: '🥤', taxExempt: false },
  { code: 'PUR-003',nameAr: 'تعبئة وتغليف',            nameEn: 'Packaging',                   type: 'expense', icon: '📦', taxExempt: false },
  { code: 'PUR-004',nameAr: 'مستلزمات تشغيل مطبخ',    nameEn: 'Kitchen Operations',          type: 'expense', icon: '🔥', taxExempt: false },
  { code: 'EXP-004',nameAr: 'رواتب وأجور',            nameEn: 'Salaries & Wages',            type: 'expense', icon: '💸', taxExempt: true  },
  { code: 'EXP-002',nameAr: 'رسوم حكومية وإقامات',   nameEn: 'Gov Fees & Iqama',            type: 'expense', icon: '🏛️', taxExempt: true  },
  { code: 'EXP-003',nameAr: 'إيجار ومرافق (كهرباء/ماء)', nameEn: 'Rent & Utilities',       type: 'expense', icon: '🏠', taxExempt: false },
  { code: 'EXP-005',nameAr: 'صيانة وتشغيل',          nameEn: 'Maintenance & Operations',    type: 'expense', icon: '🛠️', taxExempt: false },
  { code: 'EXP-006',nameAr: 'تسويق وهدايا',           nameEn: 'Marketing & Gifts',           type: 'expense', icon: '📣', taxExempt: false },
  { code: 'EXP-007',nameAr: 'مصروفات مالية',          nameEn: 'Financial Expenses',          type: 'expense', icon: '🏦', taxExempt: false },
  { code: 'EXP-008',nameAr: 'أصول ومعدات',            nameEn: 'Assets & Equipment',          type: 'expense', icon: '🖥️', taxExempt: false },
];

export const MASTER_VAULTS: MasterVaultSeed[] = [
  { accountCode: 'V-001', nameAr: 'نقد', nameEn: 'CASH', type: 'cash' },
  { accountCode: 'V-002', nameAr: 'بنك', nameEn: 'BANK', type: 'bank' },
];

/** فئات مرتبطة بحسابات — للعرض في واجهة الفئات وتقارير P&L */
export const MASTER_CATEGORIES: MasterCategorySeed[] = [
  { accountCode: 'PUR-001', nameAr: 'مواد غذائية', type: 'purchase' },
  { accountCode: 'PUR-002', nameAr: 'مشروبات', type: 'purchase' },
  { accountCode: 'PUR-003', nameAr: 'تعبئة وتغليف', type: 'purchase' },
  { accountCode: 'PUR-004', nameAr: 'مستلزمات تشغيل مطبخ', type: 'purchase' },
  { accountCode: 'EXP-004', nameAr: 'رواتب وأجور', type: 'expense' },
  { accountCode: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', type: 'expense' },
  { accountCode: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', type: 'expense' },
  { accountCode: 'EXP-005', nameAr: 'صيانة وتشغيل', type: 'expense' },
  { accountCode: 'EXP-006', nameAr: 'تسويق وهدايا', type: 'expense' },
  { accountCode: 'EXP-007', nameAr: 'مصروفات مالية', type: 'expense' },
  { accountCode: 'EXP-008', nameAr: 'أصول ومعدات', type: 'expense' },
  { accountCode: 'REV-001', nameAr: 'المبيعات', type: 'sale' },
];

/** فئات فرعية مقترحة — تحت كل فرع رئيسي */
export interface SubCategorySeed {
  parentAccountCode: string;
  nameAr: string;
  nameEn: string;
  code: string;       // كود تحليلي: P1-1، E3-2 ...
  sortOrder?: number;
}
export const MASTER_SUBCATEGORIES: SubCategorySeed[] = [
  // تحت PUR-001 — مواد غذائية  (بادئة P1)
  { parentAccountCode: 'PUR-001', code: 'P1-1', nameAr: 'لحوم',              nameEn: 'Meat',                      sortOrder: 0 },
  { parentAccountCode: 'PUR-001', code: 'P1-2', nameAr: 'دجاج',              nameEn: 'Poultry',                   sortOrder: 1 },
  { parentAccountCode: 'PUR-001', code: 'P1-3', nameAr: 'خضار وفواكه',       nameEn: 'Vegetables & Fruits',       sortOrder: 2 },
  { parentAccountCode: 'PUR-001', code: 'P1-4', nameAr: 'بضاعة تموينية',     nameEn: 'Grocery Goods',             sortOrder: 3 },
  { parentAccountCode: 'PUR-001', code: 'P1-5', nameAr: 'خامات',             nameEn: 'Raw Materials',             sortOrder: 4 },
  { parentAccountCode: 'PUR-001', code: 'P1-6', nameAr: 'مواد غذائية أخرى', nameEn: 'Other Food Items',          sortOrder: 5 },
  // تحت PUR-002 — مشروبات  (بادئة P2)
  { parentAccountCode: 'PUR-002', code: 'P2-1', nameAr: 'غازيات',            nameEn: 'Soft Drinks',               sortOrder: 0 },
  { parentAccountCode: 'PUR-002', code: 'P2-2', nameAr: 'مياه',              nameEn: 'Water',                     sortOrder: 1 },
  { parentAccountCode: 'PUR-002', code: 'P2-3', nameAr: 'عصائر',             nameEn: 'Juices',                    sortOrder: 2 },
  // تحت PUR-003 — تعبئة وتغليف  (بادئة P3)
  { parentAccountCode: 'PUR-003', code: 'P3-1', nameAr: 'بلاستيكات',         nameEn: 'Plastics',                  sortOrder: 0 },
  { parentAccountCode: 'PUR-003', code: 'P3-2', nameAr: 'علب وأكواب',        nameEn: 'Cups & Containers',         sortOrder: 1 },
  { parentAccountCode: 'PUR-003', code: 'P3-3', nameAr: 'أكياس',             nameEn: 'Bags',                      sortOrder: 2 },
  // تحت PUR-004 — مستلزمات تشغيل مطبخ  (بادئة P4)
  { parentAccountCode: 'PUR-004', code: 'P4-1', nameAr: 'فحم',               nameEn: 'Charcoal',                  sortOrder: 0 },
  { parentAccountCode: 'PUR-004', code: 'P4-2', nameAr: 'غاز طبخ',           nameEn: 'Cooking Gas',               sortOrder: 1 },
  { parentAccountCode: 'PUR-004', code: 'P4-3', nameAr: 'مواد تشغيلية',      nameEn: 'Operational Supplies',      sortOrder: 2 },
  { parentAccountCode: 'PUR-004', code: 'P4-4', nameAr: 'مواد تنظيف مطبخ',  nameEn: 'Kitchen Cleaning Supplies', sortOrder: 3 },
  // تحت EXP-003 — إيجار ومرافق  (بادئة E3)
  { parentAccountCode: 'EXP-003', code: 'E3-1', nameAr: 'إيجارات',           nameEn: 'Rent',                      sortOrder: 0 },
  { parentAccountCode: 'EXP-003', code: 'E3-2', nameAr: 'كهرباء',            nameEn: 'Electricity',               sortOrder: 1 },
  { parentAccountCode: 'EXP-003', code: 'E3-3', nameAr: 'اتصالات',           nameEn: 'Telecommunications',        sortOrder: 2 },
  { parentAccountCode: 'EXP-003', code: 'E3-4', nameAr: 'ماء',               nameEn: 'Water',                     sortOrder: 3 },
  { parentAccountCode: 'EXP-003', code: 'E3-5', nameAr: 'غاز',               nameEn: 'Gas',                       sortOrder: 4 },
  // تحت EXP-005 — صيانة وتشغيل  (بادئة E5)
  { parentAccountCode: 'EXP-005', code: 'E5-1', nameAr: 'صيانة آلات',        nameEn: 'Equipment Maintenance',     sortOrder: 0 },
  { parentAccountCode: 'EXP-005', code: 'E5-2', nameAr: 'قطع غيار',          nameEn: 'Spare Parts',               sortOrder: 1 },
  { parentAccountCode: 'EXP-005', code: 'E5-3', nameAr: 'وقود ومواصلات',     nameEn: 'Fuel & Transportation',     sortOrder: 2 },
  // تحت EXP-002 — رسوم حكومية وإقامات  (بادئة E2)
  { parentAccountCode: 'EXP-002', code: 'E2-1', nameAr: 'رخصة تجارية',       nameEn: 'Commercial License',        sortOrder: 0 },
  { parentAccountCode: 'EXP-002', code: 'E2-2', nameAr: 'رخصة بلدية',        nameEn: 'Municipal License',         sortOrder: 1 },
  { parentAccountCode: 'EXP-002', code: 'E2-3', nameAr: 'دفاع مدني',         nameEn: 'Civil Defense',             sortOrder: 2 },
  { parentAccountCode: 'EXP-002', code: 'E2-4', nameAr: 'إقامات وجوازات',    nameEn: 'Iqama & Passports',         sortOrder: 3 },
  { parentAccountCode: 'EXP-002', code: 'E2-5', nameAr: 'زيارات',            nameEn: 'Visit Visas',               sortOrder: 4 },
  { parentAccountCode: 'EXP-002', code: 'E2-6', nameAr: 'غرامات',            nameEn: 'Fines & Penalties',         sortOrder: 5 },
  { parentAccountCode: 'EXP-002', code: 'E2-7', nameAr: 'ضرائب ورسوم أخرى', nameEn: 'Other Taxes & Fees',        sortOrder: 6 },
  // تحت EXP-007 — مصروفات مالية  (بادئة E7)
  { parentAccountCode: 'EXP-007', code: 'E7-1', nameAr: 'رسوم تحويل',        nameEn: 'Transfer Fees',             sortOrder: 0 },
  { parentAccountCode: 'EXP-007', code: 'E7-2', nameAr: 'رسوم سحب',          nameEn: 'Withdrawal Fees',           sortOrder: 1 },
  { parentAccountCode: 'EXP-007', code: 'E7-3', nameAr: 'رسوم إدارة حساب',   nameEn: 'Account Management Fees',   sortOrder: 2 },
  { parentAccountCode: 'EXP-007', code: 'E7-4', nameAr: 'فوائد ورسوم قروض',  nameEn: 'Loan Interest & Fees',      sortOrder: 3 },
  { parentAccountCode: 'EXP-007', code: 'E7-5', nameAr: 'رسوم أخرى',         nameEn: 'Other Fees',                sortOrder: 4 },
  // تحت EXP-008 — أصول ومعدات  (بادئة E8)
  { parentAccountCode: 'EXP-008', code: 'E8-1', nameAr: 'أثاث',               nameEn: 'Furniture',                 sortOrder: 0 },
  { parentAccountCode: 'EXP-008', code: 'E8-2', nameAr: 'معدات مكتبية',       nameEn: 'Office Equipment',          sortOrder: 1 },
  { parentAccountCode: 'EXP-008', code: 'E8-3', nameAr: 'أجهزة وإلكترونيات', nameEn: 'Devices & Electronics',     sortOrder: 2 },
  { parentAccountCode: 'EXP-008', code: 'E8-4', nameAr: 'مركبات',             nameEn: 'Vehicles',                  sortOrder: 3 },
  { parentAccountCode: 'EXP-008', code: 'E8-5', nameAr: 'آلات ومعدات',        nameEn: 'Machinery & Equipment',     sortOrder: 4 },
  { parentAccountCode: 'EXP-008', code: 'E8-6', nameAr: 'أصول أخرى',          nameEn: 'Other Assets',              sortOrder: 5 },
];

/** موردين خدمات افتراضيين — يُنشَؤون مع كل شركة جديدة */
export interface MasterSupplierSeed {
  parentAccountCode: string;
  subCategoryNameAr: string;
  nameAr: string;
  nameEn: string;
  taxNumber: string | null;
}
export const MASTER_SUPPLIERS: MasterSupplierSeed[] = [
  {
    parentAccountCode: 'EXP-003',
    subCategoryNameAr: 'كهرباء',
    nameAr: 'الشركة السعودية للكهرباء',
    nameEn: 'Saudi Electricity Company (SEC)',
    taxNumber: '300002471100003',
  },
  {
    parentAccountCode: 'EXP-003',
    subCategoryNameAr: 'اتصالات',
    nameAr: 'الاتصالات السعودية (STC)',
    nameEn: 'Saudi Telecom Company (STC)',
    taxNumber: '300000157210003',
  },
];

