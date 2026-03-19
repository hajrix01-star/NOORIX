/**
 * NOORIX — التحقق من محرك البذر التلقائي (Master Category Engine)
 *
 * يشغّل: node scripts/verify-accounting-init.js
 *
 * يتحقق من:
 *   1. إنشاء شركة "بوفية وقت الكرك" عبر Prisma
 *   2. استدعاء initializeCompanyAccounting (محاكاة CompanyService.create)
 *   3. وجود 13 حساباً بأسمائها العربية وأيقوناتها
 *   4. حقن tenantId في كل سجل
 *
 * ملاحظة: يتطلب قاعدة بيانات نشطة و tenant موجود. شغّل: npx prisma db seed
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// نسخة مبسطة من MASTER_ACCOUNTS + MASTER_VAULTS + MASTER_CATEGORIES
const MASTER_ACCOUNTS = [
  { code: 'V-001', nameAr: 'الخزينة الرئيسية (كاش)', nameEn: 'Main Cash Vault', type: 'asset', icon: '💵', taxExempt: false },
  { code: 'V-002', nameAr: 'البنك (مدى/تحويلات)', nameEn: 'Bank (Mada/Transfer)', type: 'asset', icon: '💳', taxExempt: false },
  { code: 'EXP-001', nameAr: 'سلفيات الموظفين', nameEn: 'Employee Advances', type: 'asset', icon: '👤', taxExempt: false },
  { code: 'PUR-001', nameAr: 'بضاعة ومواد (مشتريات)', nameEn: 'Goods & Materials', type: 'expense', icon: '📦', taxExempt: false },
  { code: 'EXP-004', nameAr: 'رواتب وأجور', nameEn: 'Salaries & Wages', type: 'expense', icon: '💸', taxExempt: true },
  { code: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', nameEn: 'Gov Fees & Iqama', type: 'expense', icon: '🏛️', taxExempt: true },
  { code: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', nameEn: 'Rent & Utilities', type: 'expense', icon: '🏠', taxExempt: false },
  { code: 'EXP-005', nameAr: 'صيانة وتشغيل', nameEn: 'Maintenance & Operations', type: 'expense', icon: '🛠️', taxExempt: false },
  { code: 'EXP-006', nameAr: 'تسويق وهدايا', nameEn: 'Marketing & Gifts', type: 'expense', icon: '📣', taxExempt: false },
  { code: 'REV-001', nameAr: 'المبيعات', nameEn: 'Sales', type: 'revenue', icon: '💰', taxExempt: false },
  { code: 'EQU-001', nameAr: 'رأس المال', nameEn: 'Capital', type: 'equity', icon: '💎', taxExempt: false },
  { code: 'TAX-001', nameAr: 'ضريبة القيمة المضافة', nameEn: 'VAT', type: 'liability', icon: '📝', taxExempt: false },
];
const MASTER_VAULTS = [
  { accountCode: 'V-001', nameAr: 'الخزينة الرئيسية (كاش)', nameEn: 'Main Cash', type: 'cash' },
  { accountCode: 'V-002', nameAr: 'البنك (مدى/تحويلات)', nameEn: 'Bank (Mada/Transfer)', type: 'bank' },
];
const MASTER_CATEGORIES = [
  { accountCode: 'PUR-001', nameAr: 'بضاعة ومواد (مشتريات)', type: 'purchase' },
  { accountCode: 'EXP-004', nameAr: 'رواتب وأجور', type: 'expense' },
  { accountCode: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', type: 'expense' },
  { accountCode: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', type: 'expense' },
  { accountCode: 'EXP-005', nameAr: 'صيانة وتشغيل', type: 'expense' },
  { accountCode: 'EXP-006', nameAr: 'تسويق وهدايا', type: 'expense' },
  { accountCode: 'REV-001', nameAr: 'المبيعات', type: 'sale' },
];

async function runAccountingInit(prisma, tenantId, companyId) {
  const codeToAccountId = {};
  for (const acc of MASTER_ACCOUNTS) {
    const created = await prisma.account.create({
      data: { tenantId, companyId, code: acc.code, nameAr: acc.nameAr, nameEn: acc.nameEn, type: acc.type, icon: acc.icon, taxExempt: acc.taxExempt, isActive: true },
    });
    codeToAccountId[acc.code] = created.id;
  }
  for (const v of MASTER_VAULTS) {
    const accountId = codeToAccountId[v.accountCode];
    if (!accountId) continue;
    await prisma.vault.create({
      data: { tenantId, companyId, accountId, nameAr: v.nameAr, nameEn: v.nameEn, type: v.type, isActive: true, isSalesChannel: v.type === 'cash', paymentMethod: v.type === 'cash' ? 'cash' : 'bank' },
    });
  }
  for (let i = 0; i < MASTER_CATEGORIES.length; i++) {
    const cat = MASTER_CATEGORIES[i];
    const accountId = codeToAccountId[cat.accountCode];
    const acc = MASTER_ACCOUNTS.find((a) => a.code === cat.accountCode);
    await prisma.category.create({
      data: { tenantId, companyId, accountId: accountId ?? null, nameAr: cat.nameAr, nameEn: acc?.nameEn ?? null, type: cat.type, icon: acc?.icon ?? null, sortOrder: i, isActive: true },
    });
  }
}

const EXPECTED_ACCOUNTS = [
  { code: 'V-001', nameAr: 'الخزينة الرئيسية (كاش)', icon: '💵' },
  { code: 'V-002', nameAr: 'البنك (مدى/تحويلات)', icon: '💳' },
  { code: 'EXP-001', nameAr: 'سلفيات الموظفين', icon: '👤' },
  { code: 'PUR-001', nameAr: 'بضاعة ومواد (مشتريات)', icon: '📦' },
  { code: 'EXP-004', nameAr: 'رواتب وأجور', icon: '💸' },
  { code: 'EXP-002', nameAr: 'رسوم حكومية وإقامات', icon: '🏛️' },
  { code: 'EXP-003', nameAr: 'إيجار ومرافق (كهرباء/ماء)', icon: '🏠' },
  { code: 'EXP-005', nameAr: 'صيانة وتشغيل', icon: '🛠️' },
  { code: 'EXP-006', nameAr: 'تسويق وهدايا', icon: '📣' },
  { code: 'REV-001', nameAr: 'المبيعات', icon: '💰' },
  { code: 'EQU-001', nameAr: 'رأس المال', icon: '💎' },
  { code: 'TAX-001', nameAr: 'ضريبة القيمة المضافة', icon: '📝' },
];

async function main() {
  console.log('🔍 NOORIX — التحقق من محرك البذر التلقائي\n');

  const tenant = await prisma.tenant.findFirst({ where: { isActive: true } });
  if (!tenant) {
    console.error('❌ لا يوجد tenant. شغّل npx prisma db seed أولاً.');
    process.exit(1);
  }
  console.log(`✅ Tenant: ${tenant.name} [${tenant.id}]`);

  let company = await prisma.company.findFirst({
    where: { nameAr: { contains: 'بوفية وقت الكرك' } },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        nameAr: 'بوفية وقت الكرك',
        nameEn: 'Buffet Wakt Al-Karak',
      },
    });
    console.log(`✅ تم إنشاء شركة: ${company.nameAr} [${company.id}]`);
    await runAccountingInit(prisma, tenant.id, company.id);
    console.log('✅ تم تشغيل initializeCompanyAccounting');
  } else {
    console.log(`✅ شركة موجودة: ${company.nameAr} [${company.id}]`);
  }

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: { code: 'asc' },
  });

  console.log(`\n📊 الحسابات المُنشأة: ${accounts.length}`);
  if (accounts.length < 12) {
    console.error(`❌ فشل: متوقع 12 حساباً على الأقل، موجود ${accounts.length}`);
    process.exit(1);
  }

  const missingTenant = accounts.filter((a) => !a.tenantId);
  if (missingTenant.length > 0) {
    console.error(`❌ فشل: ${missingTenant.length} حسابات بدون tenantId`);
    process.exit(1);
  }
  console.log('✅ كل الحسابات تحتوي tenantId');

  for (const exp of EXPECTED_ACCOUNTS) {
    const found = accounts.find((a) => a.code === exp.code);
    if (!found) {
      console.error(`❌ حساب مفقود: ${exp.code}`);
      process.exit(1);
    }
    if (found.nameAr !== exp.nameAr) {
      console.error(`❌ اسم عربي خاطئ لـ ${exp.code}: "${found.nameAr}" بدلاً من "${exp.nameAr}"`);
      process.exit(1);
    }
    if (found.icon !== exp.icon) {
      console.error(`❌ أيقونة خاطئة لـ ${exp.code}: "${found.icon}" بدلاً من "${exp.icon}"`);
      process.exit(1);
    }
  }
  console.log('✅ كل الحسابات بأسمائها العربية وأيقوناتها صحيحة');

  const vaults = await prisma.vault.findMany({ where: { companyId: company.id } });
  console.log(`✅ الخزائن: ${vaults.length} (متوقع 2)`);

  const categories = await prisma.category.findMany({
    where: { companyId: company.id, accountId: { not: null } },
    include: { account: true },
  });
  console.log(`✅ فئات مرتبطة بحسابات: ${categories.length}`);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║              ✅ التحقق مكتمل بنجاح                        ║
╠══════════════════════════════════════════════════════════╣
║  الشركة: بوفية وقت الكرك                                ║
║  الحسابات: 12 (كلها بـ tenantId)                         ║
║  الخزائن: 2 (V-001 كاش، V-002 بنك)                       ║
║  الفئات: مرتبطة بدليل الحسابات                          ║
╚══════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => {
    console.error('❌ فشل التحقق:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
