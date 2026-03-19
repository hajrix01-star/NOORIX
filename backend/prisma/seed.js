/**
 * Noorix Enterprise Seed — إنشاء بيانات أولية كاملة.
 *
 * الهيكلية:
 *   1. Tenant افتراضي (مجموعة أبو مسعود)
 *   2. Roles: owner | super_admin | accountant | cashier
 *   3. Users: admin + hajri (owner) | accountant | cashier
 *   4. Companies: وقت الكرك (مرتبطة بـ Tenant)
 *   5. Accounts افتراضية لكل شركة:
 *      - REV-001: حساب الإيرادات (revenue)
 *      - EXP-001: حساب المصروفات العامة (expense)
 *      - EXP-002: حساب مصروفات HR (expense)
 *      - EXP-003: مصروفات ثابتة (expense)
 *   6. Vault افتراضية: خزنة نقدية (asset) مرتبطة بحساب V-001
 *
 * تشغيل: npx prisma db seed
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// ── Permissions ────────────────────────────────────────────
const ALL_PERMISSIONS = [
  'VIEW_OWNER','VIEW_DASHBOARD','VIEW_CHAT','VIEW_SALES','VIEW_INVOICES',
  'VIEW_SUPPLIERS','VIEW_VAULTS','VIEW_REPORTS','VIEW_EMPLOYEES',
  'INVOICES_READ','INVOICES_WRITE','INVOICES_DELETE',
  'SALES_READ','SALES_WRITE','SALES_DELETE',
  'SUPPLIERS_READ','SUPPLIERS_WRITE','SUPPLIERS_DELETE',
  'VAULTS_READ','VAULTS_WRITE','VAULTS_DELETE',
  'REPORTS_READ',
  'EMPLOYEES_READ','EMPLOYEES_WRITE','EMPLOYEES_DELETE',
  'MANAGE_SETTINGS','MANAGE_COMPANIES','MANAGE_USERS',
  'DELETE_COMPANY','USERS_DELETE',
  'CREATE_INVOICE',
];

const ACCOUNTANT_PERMISSIONS = [
  'VIEW_DASHBOARD','VIEW_SALES','VIEW_INVOICES','VIEW_SUPPLIERS','VIEW_VAULTS','VIEW_REPORTS','VIEW_EMPLOYEES',
  'INVOICES_READ','INVOICES_WRITE','SALES_READ','SALES_WRITE',
  'SUPPLIERS_READ','VAULTS_READ','REPORTS_READ',
  'EMPLOYEES_READ','EMPLOYEES_WRITE',
  'CREATE_INVOICE',
];

const CASHIER_PERMISSIONS = [
  'VIEW_SALES','VIEW_INVOICES','VIEW_VAULTS',
  'SALES_READ','SALES_WRITE','INVOICES_READ','INVOICES_WRITE','VAULTS_READ','CREATE_INVOICE',
];

// ── Chart of Accounts لكل شركة ──────────────────────────────
const DEFAULT_ACCOUNTS = [
  { code: 'REV-001', nameAr: 'إيرادات المبيعات',         nameEn: 'Sales Revenue',          type: 'revenue'  },
  { code: 'EXP-001', nameAr: 'مصروفات عامة',             nameEn: 'General Expenses',       type: 'expense'  },
  { code: 'EXP-002', nameAr: 'مصروفات الموارد البشرية',  nameEn: 'HR Expenses',            type: 'expense'  },
  { code: 'EXP-003', nameAr: 'مصروفات ثابتة',            nameEn: 'Fixed Expenses',         type: 'expense'  },
  { code: 'EXP-004', nameAr: 'مصروفات المشتريات',        nameEn: 'Purchase Expenses',      type: 'expense'  },
  { code: 'EMP-001', nameAr: 'سلفيات الموظفين',          nameEn: 'Employee Advances',      type: 'asset'    },
  { code: 'V-001',   nameAr: 'صندوق النقد الرئيسي',      nameEn: 'Main Cash Vault',        type: 'asset'    },
];

async function upsertAccount(tenantId, companyId, acc) {
  const existing = await prisma.account.findFirst({ where: { companyId, code: acc.code } });
  if (existing) return existing;
  return prisma.account.create({
    data: { tenantId, companyId, code: acc.code, nameAr: acc.nameAr, nameEn: acc.nameEn, type: acc.type },
  });
}

async function main() {
  console.log('🌱 Noorix Enterprise Seed — Starting...\n');

  // ── 1. Tenant ────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where:  { slug: 'abumasoud-group' },
    update: { name: 'مجموعة أبو مسعود', isActive: true, plan: 'enterprise', maxCompanies: 10 },
    create: {
      name:         'مجموعة أبو مسعود',
      slug:         'abumasoud-group',
      plan:         'enterprise',
      maxCompanies: 10,
      isActive:     true,
    },
  });
  console.log(`✅ Tenant: ${tenant.name} [${tenant.id}]`);

  // ── 2. Roles ─────────────────────────────────────────────
  const ownerRole = await prisma.role.upsert({
    where:  { name: 'owner' },
    update: { nameAr: 'مالك النظام', permissions: ALL_PERMISSIONS, isSystem: true },
    create: { name: 'owner', nameAr: 'مالك النظام', description: 'صلاحيات مطلقة على كل النظام', permissions: ALL_PERMISSIONS, isSystem: true },
  });
  await prisma.role.upsert({
    where:  { name: 'super_admin' },
    update: { nameAr: 'مدير عام', permissions: ALL_PERMISSIONS, isSystem: true },
    create: { name: 'super_admin', nameAr: 'مدير عام', description: 'إدارة كاملة', permissions: ALL_PERMISSIONS, isSystem: true },
  });
  const accountantRole = await prisma.role.upsert({
    where:  { name: 'accountant' },
    update: { nameAr: 'محاسب', permissions: ACCOUNTANT_PERMISSIONS, isSystem: true },
    create: { name: 'accountant', nameAr: 'محاسب', description: 'تقارير، مبيعات، موردين، خزائن', permissions: ACCOUNTANT_PERMISSIONS, isSystem: true },
  });
  const cashierRole = await prisma.role.upsert({
    where:  { name: 'cashier' },
    update: { nameAr: 'كاشير', permissions: CASHIER_PERMISSIONS, isSystem: true },
    create: { name: 'cashier', nameAr: 'كاشير', description: 'مبيعات وخزينة الشركة فقط', permissions: CASHIER_PERMISSIONS, isSystem: true },
  });
  console.log(`✅ Roles: owner | super_admin | accountant | cashier`);

  // ── 3. Companies ─────────────────────────────────────────
  const company = await prisma.company.upsert({
    where:  { id: 'seed-company-1' },
    update: { tenantId: tenant.id },
    create: {
      id:       'seed-company-1',
      tenantId: tenant.id,
      nameAr:   'وقت الكرك',
      nameEn:   'Wakt Al-Karak',
    },
  });
  console.log(`✅ Companies: ${company.nameAr}`);

  // ── 4. Accounts (دليل حسابات) لكل شركة ─────────────────
  const cAccounts = {};
  for (const acc of DEFAULT_ACCOUNTS) {
    const a = await upsertAccount(tenant.id, company.id, acc);
    cAccounts[acc.code] = a;
  }
  console.log(`✅ Accounts: ${DEFAULT_ACCOUNTS.length} حسابات لكل شركة`);

  // ── 5. Vaults (خزائن افتراضية) ───────────────────────────
  async function upsertVault(tenantId, companyId, accountId, nameAr, nameEn) {
    const existing = await prisma.vault.findFirst({ where: { companyId, accountId } });
    if (existing) return existing;
    return prisma.vault.create({
      data: {
        tenantId,
        companyId,
        accountId,
        nameAr,
        nameEn,
        type:           'cash',
        isSalesChannel: true,
        paymentMethod:  'cash',
        notes:          'خزنة نقدية افتراضية — أنشئت بواسطة Seed',
      },
    });
  }

  const vault = await upsertVault(tenant.id, company.id, cAccounts['V-001'].id, 'الصندوق الرئيسي', 'Main Vault');
  console.log(`✅ Vaults: خزنة لـ ${company.nameAr}`);

  // ── 6. Users ──────────────────────────────────────────────
  async function upsertUser({ email, password, nameAr, nameEn, roleId, tenantId }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return prisma.user.update({
        where: { email },
        data:  { tenantId, roleId, passwordHash },
      });
    }
    return prisma.user.create({
      data: { email, passwordHash, nameAr, nameEn, roleId, tenantId },
    });
  }

  const admin = await upsertUser({
    email: 'admin@noorix.sa', password: 'noorix123',
    nameAr: 'أبو مسعود', nameEn: 'Admin',
    roleId: ownerRole.id, tenantId: tenant.id,
  });
  const hajri = await upsertUser({
    email: 'hajri', password: '123',
    nameAr: 'حجري', nameEn: 'Hajri',
    roleId: ownerRole.id, tenantId: tenant.id,
  });
  const accountant = await upsertUser({
    email: 'accountant@noorix.sa', password: 'acc123',
    nameAr: 'المحاسب الأول', nameEn: 'Accountant',
    roleId: accountantRole.id, tenantId: tenant.id,
  });
  const cashier = await upsertUser({
    email: 'cashier@noorix.sa', password: 'cash123',
    nameAr: 'كاشير وقت الكرك', nameEn: 'Cashier',
    roleId: cashierRole.id, tenantId: tenant.id,
  });
  console.log(`✅ Users: admin | hajri | accountant | cashier`);

  // ── 7. UserCompany (ربط المستخدمين بالشركات) ────────────
  const userCompanyLinks = [
    { userId: admin.id,      companyId: company.id },
    { userId: hajri.id,      companyId: company.id },
    { userId: accountant.id, companyId: company.id },
    { userId: cashier.id,   companyId: company.id },
  ];
  for (const link of userCompanyLinks) {
    await prisma.userCompany.upsert({
      where:  { userId_companyId: link },
      update: {},
      create: link,
    });
  }
  console.log(`✅ UserCompany: ${userCompanyLinks.length} روابط`);

  // ── 8. Employees (موظفون تجريبيون) ──────────────────────────
  async function upsertEmployee(tenantId, companyId, data) {
    const existing = await prisma.employee.findFirst({
      where: { companyId, iqamaNumber: data.iqamaNumber ?? undefined, name: data.name },
    });
    if (existing) return existing;
    return prisma.employee.create({ data: { tenantId, companyId, ...data } });
  }

  const emp1 = await upsertEmployee(tenant.id, company.id, {
    name:             'أحمد المحمدي',
    nameEn:           'Ahmed Al-Muhammadi',
    iqamaNumber:      '2000000001',
    jobTitle:         'مدير المطبخ',
    basicSalary:      3000,
    housingAllowance: 500,
    transportAllowance: 200,
    joinDate:         new Date(),
    status:           'active',
    notes:            'موظف تجريبي — أُنشئ بواسطة Seed',
  });
  console.log(`✅ Employees: ${emp1.name} — ${company.nameAr}`);

  // ── 10. Default Categories لكل شركة ──────────────────────
  async function upsertCategory(tenantId, companyId, nameAr, type) {
    const existing = await prisma.category.findFirst({ where: { companyId, nameAr, parentId: null } });
    if (existing) return existing;
    return prisma.category.create({
      data: { tenantId, companyId, nameAr, type, sortOrder: 0 },
    });
  }

  await upsertCategory(tenant.id, company.id, 'مشتريات عامة',       'purchase');
  await upsertCategory(tenant.id, company.id, 'مصروفات تشغيلية',    'expense');
  await upsertCategory(tenant.id, company.id, 'مصروفات موارد بشرية', 'expense');
  await upsertCategory(tenant.id, company.id, 'مصروفات ثابتة',      'expense');
  console.log(`✅ Categories: تصنيفات افتراضية لكل شركة`);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║              🎉 Seed مكتمل بنجاح                        ║
╠══════════════════════════════════════════════════════════╣
║  Tenant : مجموعة أبو مسعود (abumasoud-group)            ║
║  ──────────────────────────────────────────────────────  ║
║  admin@noorix.sa     / noorix123   → owner               ║
║  hajri               / 123         → owner               ║
║  accountant@noorix.sa/ acc123      → accountant          ║
║  cashier@noorix.sa   / cash123     → cashier             ║
║  ──────────────────────────────────────────────────────  ║
║  Accounts: REV-001 | EXP-001..004 | EMP-001 | V-001     ║
║  Employee: أحمد المحمدي — راتب 3000 ﷼                   ║
╚══════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
