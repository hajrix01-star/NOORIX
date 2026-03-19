/**
 * حذف شركتي VIP و المعلم الشامي بالكامل من قاعدة البيانات.
 * يشغّل: node prisma/delete-companies.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAMES_TO_DELETE = ['المعلم الشامي', 'VIP', 'شركة VIP'];

async function deleteCompanyCascade(companyId) {
  // 1. حذف قنوات المبيعات اليومية (ترتبط بـ vault)
  const summaries = await prisma.dailySalesSummary.findMany({
    where: { companyId },
    select: { id: true },
  });
  const summaryIds = summaries.map((s) => s.id);
  if (summaryIds.length > 0) {
    await prisma.dailySalesChannel.deleteMany({
      where: { summaryId: { in: summaryIds } },
    });
  }
  await prisma.dailySalesSummary.deleteMany({ where: { companyId } });

  // 2. حذف الشركة (Cascade يحذف الباقي)
  await prisma.company.delete({ where: { id: companyId } });
}

async function main() {
  console.log('🗑️ حذف الشركات: المعلم الشامي، VIP...\n');

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { nameAr: { in: NAMES_TO_DELETE } },
        { nameEn: { in: ['Al-Moalem Al-Shami', 'Al-Moallim Al-Shami'] } },
      ],
    },
  });

  if (companies.length === 0) {
    console.log('✅ لا توجد شركات مطابقة للحذف.');
    return;
  }

  for (const c of companies) {
    console.log(`  حذف: ${c.nameAr} (${c.id})...`);
    await deleteCompanyCascade(c.id);
    console.log(`  ✓ تم حذف ${c.nameAr}`);
  }

  console.log(`\n✅ تم حذف ${companies.length} شركة بالكامل.`);
}

main()
  .catch((e) => {
    console.error('❌ فشل الحذف:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
