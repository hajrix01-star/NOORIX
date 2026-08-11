/**
 * NOORIX Seed — يعمل على قاعدة بيانات جديدة (إنتاج) أو موجودة (تطوير)
 * ينشئ: Tenant، Roles، Company، User، UserCompany + تهيئة دليل الحسابات
 * بيانات الدخول الافتراضية: admin@hajrix.com / 123
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// ─── ثوابت تهيئة المحاسبة (مطابقة لـ accounting-init.service.ts) ───
const MASTER_ACCOUNTS = [
  { code: 'V-001',   nameAr: 'نقد',                            nameEn: 'CASH',                      type: 'asset',    icon: '💵', taxExempt: false },
  { code: 'V-002',   nameAr: 'بنك',                            nameEn: 'BANK',                      type: 'asset',    icon: '💳', taxExempt: false },
  { code: 'AR-001',  nameAr: 'الذمم المدينة (عملاء)',         nameEn: 'Accounts Receivable',      type: 'asset',    icon: '🧾', taxExempt: false },
  { code: 'AP-001',  nameAr: 'الذمم الدائنة (موردون)',        nameEn: 'Accounts Payable',         type: 'liability',icon: '📋', taxExempt: false },
  { code: 'TAX-001', nameAr: 'ضريبة القيمة المضافة',          nameEn: 'VAT',                      type: 'liability',icon: '📝', taxExempt: false },
  { code: 'PAY-001', nameAr: '\u0631\u0648\u0627\u062A\u0628 \u0645\u0633\u062A\u062D\u0642\u0629', nameEn: 'Payroll Payable', type: 'liability',icon: '\u{1F4BC}', taxExempt: true },
  { code: 'EQU-001', nameAr: 'رأس المال',                    nameEn: 'Capital',                  type: 'equity',   icon: '💎', taxExempt: false },
  { code: 'REV-001', nameAr: 'المبيعات',                     nameEn: 'Sales',                    type: 'revenue',  icon: '💰', taxExempt: false },
  { code: 'PUR-001', nameAr: 'مواد غذائية',                  nameEn: 'Food & Materials',         type: 'expense',  icon: '🥩', taxExempt: false },
  { code: 'PUR-002', nameAr: 'مشروبات',                      nameEn: 'Beverages',                type: 'expense',  icon: '🥤', taxExempt: false },
  { code: 'PUR-003', nameAr: 'تعبئة وتغليف',                 nameEn: 'Packaging',                type: 'expense',  icon: '📦', taxExempt: false },
  { code: 'PUR-004', nameAr: 'مستلزمات تشغيل مطبخ',          nameEn: 'Kitchen Operations',       type: 'expense',  icon: '🔥', taxExempt: false },
  { code: 'EXP-002', nameAr: 'رسوم حكومية وإقامات',          nameEn: 'Gov Fees & Iqama',         type: 'expense',  icon: '🏛️', taxExempt: true  },
  { code: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)',   nameEn: 'Rent & Utilities',         type: 'expense',  icon: '🏠', taxExempt: false },
  { code: 'EXP-004', nameAr: 'رواتب وأجور',                 nameEn: 'Salaries & Wages',         type: 'expense',  icon: '💸', taxExempt: true  },
  { code: 'EXP-005', nameAr: 'صيانة وتشغيل',               nameEn: 'Maintenance & Operations', type: 'expense',  icon: '🛠️', taxExempt: false },
  { code: 'EXP-006', nameAr: 'تسويق وهدايا',               nameEn: 'Marketing & Gifts',        type: 'expense',  icon: '📣', taxExempt: false },
  { code: 'EXP-007', nameAr: 'مصروفات مالية',              nameEn: 'Financial Expenses',       type: 'expense',  icon: '🏦', taxExempt: false },
  { code: 'EXP-008', nameAr: 'أصول ومعدات',               nameEn: 'Assets & Equipment',       type: 'expense',  icon: '🖥️', taxExempt: false },
];

const MASTER_CATEGORIES = [
  { accountCode: 'PUR-001', nameAr: 'مواد غذائية',              type: 'purchase' },
  { accountCode: 'PUR-002', nameAr: 'مشروبات',                  type: 'purchase' },
  { accountCode: 'PUR-003', nameAr: 'تعبئة وتغليف',             type: 'purchase' },
  { accountCode: 'PUR-004', nameAr: 'مستلزمات تشغيل مطبخ',     type: 'purchase' },
  { accountCode: 'EXP-004', nameAr: 'رواتب وأجور',              type: 'expense'  },
  { accountCode: 'EXP-002', nameAr: 'رسوم حكومية وإقامات',     type: 'expense'  },
  { accountCode: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', type: 'expense' },
  { accountCode: 'EXP-005', nameAr: 'صيانة وتشغيل',            type: 'expense'  },
  { accountCode: 'EXP-006', nameAr: 'تسويق وهدايا',            type: 'expense'  },
  { accountCode: 'EXP-007', nameAr: 'مصروفات مالية',           type: 'expense'  },
  { accountCode: 'EXP-008', nameAr: 'أصول ومعدات',             type: 'expense'  },
  { accountCode: 'REV-001', nameAr: 'المبيعات',                 type: 'sale'     },
];

const MASTER_SUBCATEGORIES = [
  { parentAccountCode: 'PUR-001', code: 'P1-1', nameAr: 'لحوم',              nameEn: 'Meat',                      sortOrder: 0 },
  { parentAccountCode: 'PUR-001', code: 'P1-2', nameAr: 'دجاج',              nameEn: 'Poultry',                   sortOrder: 1 },
  { parentAccountCode: 'PUR-001', code: 'P1-3', nameAr: 'خضار وفواكه',       nameEn: 'Vegetables & Fruits',       sortOrder: 2 },
  { parentAccountCode: 'PUR-001', code: 'P1-4', nameAr: 'بضاعة تموينية',     nameEn: 'Grocery Goods',             sortOrder: 3 },
  { parentAccountCode: 'PUR-001', code: 'P1-5', nameAr: 'خامات',             nameEn: 'Raw Materials',             sortOrder: 4 },
  { parentAccountCode: 'PUR-001', code: 'P1-6', nameAr: 'مواد غذائية أخرى', nameEn: 'Other Food Items',          sortOrder: 5 },
  { parentAccountCode: 'PUR-002', code: 'P2-1', nameAr: 'غازيات',            nameEn: 'Soft Drinks',               sortOrder: 0 },
  { parentAccountCode: 'PUR-002', code: 'P2-2', nameAr: 'مياه',              nameEn: 'Water',                     sortOrder: 1 },
  { parentAccountCode: 'PUR-002', code: 'P2-3', nameAr: 'عصائر',             nameEn: 'Juices',                    sortOrder: 2 },
  { parentAccountCode: 'PUR-003', code: 'P3-1', nameAr: 'بلاستيكات',         nameEn: 'Plastics',                  sortOrder: 0 },
  { parentAccountCode: 'PUR-003', code: 'P3-2', nameAr: 'علب وأكواب',        nameEn: 'Cups & Containers',         sortOrder: 1 },
  { parentAccountCode: 'PUR-003', code: 'P3-3', nameAr: 'أكياس',             nameEn: 'Bags',                      sortOrder: 2 },
  { parentAccountCode: 'PUR-004', code: 'P4-1', nameAr: 'فحم',               nameEn: 'Charcoal',                  sortOrder: 0 },
  { parentAccountCode: 'PUR-004', code: 'P4-2', nameAr: 'غاز طبخ',           nameEn: 'Cooking Gas',               sortOrder: 1 },
  { parentAccountCode: 'PUR-004', code: 'P4-3', nameAr: 'مواد تشغيلية',      nameEn: 'Operational Supplies',      sortOrder: 2 },
  { parentAccountCode: 'PUR-004', code: 'P4-4', nameAr: 'مواد تنظيف مطبخ',  nameEn: 'Kitchen Cleaning Supplies', sortOrder: 3 },
  { parentAccountCode: 'EXP-003', code: 'E3-1', nameAr: 'إيجارات',           nameEn: 'Rent',                      sortOrder: 0 },
  { parentAccountCode: 'EXP-003', code: 'E3-2', nameAr: 'كهرباء',            nameEn: 'Electricity',               sortOrder: 1 },
  { parentAccountCode: 'EXP-003', code: 'E3-3', nameAr: 'اتصالات',           nameEn: 'Telecommunications',        sortOrder: 2 },
  { parentAccountCode: 'EXP-003', code: 'E3-4', nameAr: 'ماء',               nameEn: 'Water',                     sortOrder: 3 },
  { parentAccountCode: 'EXP-003', code: 'E3-5', nameAr: 'غاز',               nameEn: 'Gas',                       sortOrder: 4 },
  { parentAccountCode: 'EXP-005', code: 'E5-1', nameAr: 'صيانة آلات',        nameEn: 'Equipment Maintenance',     sortOrder: 0 },
  { parentAccountCode: 'EXP-005', code: 'E5-2', nameAr: 'قطع غيار',          nameEn: 'Spare Parts',               sortOrder: 1 },
  { parentAccountCode: 'EXP-005', code: 'E5-3', nameAr: 'وقود ومواصلات',     nameEn: 'Fuel & Transportation',     sortOrder: 2 },
  { parentAccountCode: 'EXP-002', code: 'E2-1', nameAr: 'رخصة تجارية',       nameEn: 'Commercial License',        sortOrder: 0 },
  { parentAccountCode: 'EXP-002', code: 'E2-2', nameAr: 'رخصة بلدية',        nameEn: 'Municipal License',         sortOrder: 1 },
  { parentAccountCode: 'EXP-002', code: 'E2-3', nameAr: 'دفاع مدني',         nameEn: 'Civil Defense',             sortOrder: 2 },
  { parentAccountCode: 'EXP-002', code: 'E2-4', nameAr: 'إقامات وجوازات',    nameEn: 'Iqama & Passports',         sortOrder: 3 },
  { parentAccountCode: 'EXP-002', code: 'E2-5', nameAr: 'زيارات',            nameEn: 'Visit Visas',               sortOrder: 4 },
  { parentAccountCode: 'EXP-002', code: 'E2-6', nameAr: 'غرامات',            nameEn: 'Fines & Penalties',         sortOrder: 5 },
  { parentAccountCode: 'EXP-002', code: 'E2-7', nameAr: 'ضرائب ورسوم أخرى', nameEn: 'Other Taxes & Fees',        sortOrder: 6 },
  { parentAccountCode: 'EXP-002', code: 'E2-8', nameAr: 'GOSI',              nameEn: 'GOSI',                      sortOrder: 7 },
  // E2-9 محجوز للتصنيفات التاريخية المختلفة بين الشركات، ولا يُزرع مستقبلاً.
  { parentAccountCode: 'EXP-002', code: 'E2-10', nameAr: 'رسوم منصات حكومية', nameEn: 'Government Platform Fees', sortOrder: 9 },
  { parentAccountCode: 'EXP-002', code: 'E2-11', nameAr: 'شهادات صحية وتصاريح موظفين', nameEn: 'Health Certificates & Employee Permits', sortOrder: 10 },
  { parentAccountCode: 'EXP-007', code: 'E7-1', nameAr: 'رسوم تحويل',        nameEn: 'Transfer Fees',             sortOrder: 0 },
  { parentAccountCode: 'EXP-007', code: 'E7-2', nameAr: 'رسوم سحب',          nameEn: 'Withdrawal Fees',           sortOrder: 1 },
  { parentAccountCode: 'EXP-007', code: 'E7-3', nameAr: 'رسوم إدارة حساب',   nameEn: 'Account Management Fees',   sortOrder: 2 },
  { parentAccountCode: 'EXP-007', code: 'E7-4', nameAr: 'فوائد ورسوم قروض',  nameEn: 'Loan Interest & Fees',      sortOrder: 3 },
  { parentAccountCode: 'EXP-007', code: 'E7-5', nameAr: 'رسوم أخرى',         nameEn: 'Other Fees',                sortOrder: 4 },
  { parentAccountCode: 'EXP-008', code: 'E8-1', nameAr: 'أثاث',               nameEn: 'Furniture',                 sortOrder: 0 },
  { parentAccountCode: 'EXP-008', code: 'E8-2', nameAr: 'معدات مكتبية',       nameEn: 'Office Equipment',          sortOrder: 1 },
  { parentAccountCode: 'EXP-008', code: 'E8-3', nameAr: 'أجهزة وإلكترونيات', nameEn: 'Devices & Electronics',     sortOrder: 2 },
  { parentAccountCode: 'EXP-008', code: 'E8-4', nameAr: 'مركبات',             nameEn: 'Vehicles',                  sortOrder: 3 },
  { parentAccountCode: 'EXP-008', code: 'E8-5', nameAr: 'آلات ومعدات',        nameEn: 'Machinery & Equipment',     sortOrder: 4 },
  { parentAccountCode: 'EXP-008', code: 'E8-6', nameAr: 'أصول أخرى',          nameEn: 'Other Assets',              sortOrder: 5 },
];

/**
 * تهيئة دليل الحسابات للشركة — تُستدعى فقط إن لم توجد حسابات بعد
 */
async function initializeAccounting(tenantId, companyId) {
  const existingCount = await prisma.account.count({ where: { companyId } });
  if (existingCount > 0) {
    console.log('  ↳ دليل الحسابات موجود — تم التخطي');
    return;
  }

  const codeToAccountId = {};

  // 1. إنشاء الحسابات
  for (const acc of MASTER_ACCOUNTS) {
    const created = await prisma.account.create({
      data: { tenantId, companyId, code: acc.code, nameAr: acc.nameAr, nameEn: acc.nameEn, type: acc.type, icon: acc.icon, taxExempt: acc.taxExempt, isActive: true },
    });
    codeToAccountId[acc.code] = created.id;
  }
  console.log(`  ✅ حسابات: ${MASTER_ACCOUNTS.length}`);

  // 2. الخزينتان
  const vaultSeeds = [
    { accountCode: 'V-001', nameAr: 'نقد', nameEn: 'CASH', type: 'cash' },
    { accountCode: 'V-002', nameAr: 'بنك', nameEn: 'BANK', type: 'bank' },
  ];
  for (const v of vaultSeeds) {
    const accountId = codeToAccountId[v.accountCode];
    if (!accountId) continue;
    await prisma.vault.create({
      data: {
        tenantId, companyId, accountId, nameAr: v.nameAr, nameEn: v.nameEn,
        type: v.type, isActive: true, bankReconciliationEnabled: v.type === 'bank' || v.type === 'app',
      },
    });
  }
  console.log('  ✅ خزينتان (كاش + بنك)');

  // 3. السنة المالية الافتراضية
  const year = new Date().getFullYear();
  await prisma.fiscalPeriod.create({
    data: { tenantId, companyId, nameAr: `السنة المالية ${year}`, nameEn: `Fiscal Year ${year}`, startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31), status: 'open' },
  });

  // 4. الفئات الرئيسية
  const accountCodeToCategoryId = {};
  for (let i = 0; i < MASTER_CATEGORIES.length; i++) {
    const cat = MASTER_CATEGORIES[i];
    const accountId = codeToAccountId[cat.accountCode];
    const acc = MASTER_ACCOUNTS.find((a) => a.code === cat.accountCode);
    const created = await prisma.category.create({
      data: { tenantId, companyId, accountId: accountId || null, code: cat.accountCode, nameAr: cat.nameAr, nameEn: acc?.nameEn || null, type: cat.type, icon: acc?.icon || null, sortOrder: i, isActive: true },
    });
    accountCodeToCategoryId[cat.accountCode] = created.id;
  }

  // 5. الفئات الفرعية
  let subCount = 0;
  for (const sub of MASTER_SUBCATEGORIES) {
    const parentId = accountCodeToCategoryId[sub.parentAccountCode];
    const parentCat = MASTER_CATEGORIES.find((c) => c.accountCode === sub.parentAccountCode);
    if (!parentId || !parentCat) continue;
    await prisma.category.create({
      data: { tenantId, companyId, parentId, accountId: codeToAccountId[sub.parentAccountCode] || null, code: sub.code, nameAr: sub.nameAr, nameEn: sub.nameEn, type: parentCat.type, sortOrder: sub.sortOrder || 0, isActive: true },
    });
    subCount++;
  }
  console.log(`  ✅ فئات: ${MASTER_CATEGORIES.length} رئيسية + ${subCount} فرعية`);
}

const prisma = new PrismaClient();

// صلاحيات owner/super_admin (كامل الصلاحيات)
const ALL_PERMISSIONS = [
  'VIEW_OWNER', 'VIEW_DASHBOARD', 'VIEW_CHAT', 'VIEW_SALES', 'VIEW_INVOICES',
  'VIEW_SUPPLIERS', 'VIEW_VAULTS', 'VIEW_REPORTS', 'INVOICES_READ', 'INVOICES_WRITE',
  'INVOICES_DELETE', 'INVOICES_ACTIONS', 'SALES_READ', 'SALES_WRITE', 'SALES_DELETE',
  'SALES_ACTIONS', 'SUPPLIERS_READ', 'SUPPLIERS_WRITE', 'SUPPLIERS_DELETE',
  'VAULTS_READ', 'VAULTS_WRITE', 'VAULTS_DELETE', 'REPORTS_READ', 'SMART_CHAT_READ',
  'CHAT_PRESET_ADVANCES', 'CHAT_PRESET_LEAVES', 'CHAT_PRESET_DEDUCTIONS', 'CHAT_PRESET_FAQ', 'CHAT_PRESET_INCREASES',
  'MANAGE_SETTINGS', 'MANAGE_COMPANIES', 'MANAGE_USERS', 'DELETE_COMPANY', 'USERS_DELETE',
  'VIEW_EMPLOYEES', 'EMPLOYEES_READ', 'EMPLOYEES_WRITE', 'EMPLOYEES_DELETE',
  'HR_READ', 'HR_WRITE', 'HR_DELETE', 'CREATE_INVOICE',
];

const DEFAULT_TENANT_ID = 'default-tenant-noorix-2024';
const ADMIN_EMAIL = 'admin@hajrix.com';
const ADMIN_PASSWORD = '123';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // ─── 1. Tenant (Migration ينشئ default-tenant-noorix-2024 أو abumasoud-group) ───
  let tenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_TENANT_ID },
  });
  if (!tenant) {
    tenant = await prisma.tenant.findUnique({
      where: { slug: 'abumasoud-group' },
    });
  }
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: DEFAULT_TENANT_ID,
        name: 'مجموعة نويركس',
        slug: 'noorix-default',
        plan: 'enterprise',
        isActive: true,
        maxCompanies: 10,
      },
    });
    console.log('✅ تم إنشاء Tenant افتراضي');
  }

  // ─── 2. الأدوار (Roles) ───
  const roleNames = ['owner', 'super_admin', 'accountant', 'cashier'];
  const roleMap = {};

  for (const name of roleNames) {
    let role = await prisma.role.findUnique({ where: { name } });
    if (!role) {
      const permissions = (name === 'owner' || name === 'super_admin') ? ALL_PERMISSIONS : [];
      role = await prisma.role.create({
        data: {
          name,
          nameAr: name === 'owner' ? 'مالك' : name === 'super_admin' ? 'مدير عام' : name === 'accountant' ? 'محاسب' : 'كاشير',
          isSystem: true,
          permissions,
        },
      });
      console.log(`✅ تم إنشاء دور: ${name}`);
    }
    roleMap[name] = role.id;
  }

  // ─── 3. الشركة (Company) ───
  let company = await prisma.company.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        nameAr: 'شركة نويركس الافتراضية',
        nameEn: 'Noorix Default Company',
        vatEnabledForSales: false,
      },
    });
    console.log('✅ تم إنشاء شركة افتراضية');
  }

  // ─── 3b. تهيئة دليل الحسابات (إن لم يكن موجوداً) ───
  console.log('⚙️  جاري تهيئة دليل الحسابات...');
  await initializeAccounting(tenant.id, company.id);

  // ─── 4. المستخدم admin@hajrix.com ───
  let user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: ADMIN_EMAIL,
        passwordHash,
        nameAr: 'مدير النظام',
        nameEn: 'Admin',
        roleId: roleMap.owner,
        isActive: true,
      },
    });
    console.log(`✅ تم إنشاء مستخدم: ${ADMIN_EMAIL}`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log(`✅ تم تحديث كلمة مرور: ${ADMIN_EMAIL}`);
  }

  // ─── 5. ربط المستخدم بالشركة (UserCompany) ───
  const existingLink = await prisma.userCompany.findUnique({
    where: {
      userId_companyId: { userId: user.id, companyId: company.id },
    },
  });
  if (!existingLink) {
    await prisma.userCompany.create({
      data: {
        userId: user.id,
        companyId: company.id,
      },
    });
    console.log('✅ تم ربط المستخدم بالشركة');
  }

  // ─── 6. تحديث مستخدم hajri إن وُجد (للتوافق مع التطوير المحلي) ───
  const hajri = await prisma.user.findUnique({ where: { email: 'hajri' } });
  if (hajri) {
    await prisma.user.update({
      where: { email: 'hajri' },
      data: { passwordHash },
    });
    console.log('✅ تم تحديث كلمة مرور: hajri');
  }

  console.log('\n🎉 اكتمل الـ Seed بنجاح!');
  console.log(`   الدخول: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ خطأ في الـ Seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
