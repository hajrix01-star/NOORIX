/**
 * NOORIX Seed — يعمل على قاعدة بيانات جديدة (إنتاج) أو موجودة (تطوير)
 * ينشئ: Tenant، Roles، Company، User، UserCompany
 * بيانات الدخول الافتراضية: admin@noorix.sa / 123
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// صلاحيات owner/super_admin (كامل الصلاحيات)
const ALL_PERMISSIONS = [
  'VIEW_OWNER', 'VIEW_DASHBOARD', 'VIEW_CHAT', 'VIEW_SALES', 'VIEW_INVOICES',
  'VIEW_SUPPLIERS', 'VIEW_VAULTS', 'VIEW_REPORTS', 'INVOICES_READ', 'INVOICES_WRITE',
  'INVOICES_DELETE', 'INVOICES_ACTIONS', 'SALES_READ', 'SALES_WRITE', 'SALES_DELETE',
  'SALES_ACTIONS', 'SUPPLIERS_READ', 'SUPPLIERS_WRITE', 'SUPPLIERS_DELETE',
  'VAULTS_READ', 'VAULTS_WRITE', 'VAULTS_DELETE', 'REPORTS_READ', 'SMART_CHAT_READ',
  'CHAT_PRESET_ADVANCES', 'CHAT_PRESET_LEAVES', 'CHAT_PRESET_DEDUCTIONS', 'CHAT_PRESET_FAQ',
  'MANAGE_SETTINGS', 'MANAGE_COMPANIES', 'MANAGE_USERS', 'DELETE_COMPANY', 'USERS_DELETE',
  'VIEW_EMPLOYEES', 'EMPLOYEES_READ', 'EMPLOYEES_WRITE', 'EMPLOYEES_DELETE',
  'HR_READ', 'HR_WRITE', 'HR_DELETE', 'CREATE_INVOICE',
];

const DEFAULT_TENANT_ID = 'default-tenant-noorix-2024';
const ADMIN_EMAIL = 'admin@noorix.sa';
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

  // ─── 4. المستخدم admin@noorix.sa ───
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
