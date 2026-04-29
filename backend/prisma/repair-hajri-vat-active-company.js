/**
 * يصلح إقرارات HAJRI المرتبطة بشركة مؤرشفة عندما توجد شركة نشطة بنفس المفتاح المرجعي (مثل «وقت الكرك»).
 * ينقل السجل إلى الشركة النشطة أو يحذف التكرار إن وُجد إقرار على النشطة لنفس الربع.
 *
 * التشغيل من مجلد backend:
 *   node prisma/repair-hajri-vat-active-company.js
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
  /* optional */
}

const { PrismaClient } = require('@prisma/client');
const { pickCompanyForHajriKey, companyMatchesKey } = require('./lib/hajri-resolve-company.cjs');

const prisma = new PrismaClient();

const KEYS = ['ARZ', 'دوحة المستهلك', 'وقت الكرك', 'المعلم الشامي'];

async function main() {
  console.log('🔧 إصلاح إقرارات HAJRI — ربط بالشركة النشطة عند تكرار الاسم …\n');

  const companies = await prisma.company.findMany({
    select: { id: true, tenantId: true, nameAr: true, nameEn: true, isArchived: true },
  });

  let moved = 0;
  let deletedDup = 0;

  for (const key of KEYS) {
    const canonical = pickCompanyForHajriKey(key, companies);
    if (!canonical) {
      console.warn(`⚠️  لا توجد شركة لمفتاح «${key}»`);
      continue;
    }

    const others = companies.filter((c) => companyMatchesKey(key, c) && c.id !== canonical.id);
    if (others.length === 0) continue;

    console.log(
      `— ${key}: الشركة الأساسية «${canonical.nameAr || canonical.nameEn}» (${canonical.id.slice(-8)}) — بدائل: ${others.length}`,
    );

    for (const obsolete of others) {
      const rows = await prisma.vatPlanningQuarter.findMany({ where: { companyId: obsolete.id } });

      for (const row of rows) {
        const clash = await prisma.vatPlanningQuarter.findUnique({
          where: {
            companyId_year_quarter: {
              companyId: canonical.id,
              year: row.year,
              quarter: row.quarter,
            },
          },
        });

        if (!clash) {
          await prisma.vatPlanningQuarter.update({
            where: { id: row.id },
            data: {
              companyId: canonical.id,
              tenantId: canonical.tenantId,
            },
          });
          moved += 1;
          console.log(`   ✅ نقل ${row.year} Q${row.quarter} من شركة ${obsolete.isArchived ? 'مؤرشفة' : 'بديلة'} → نشطة`);
        } else {
          await prisma.vatPlanningQuarter.delete({ where: { id: row.id } });
          deletedDup += 1;
          console.log(`   🗑️ حذف نسخة مكررة ${row.year} Q${row.quarter} (موجودة على الشركة الأساسية)`);
        }
      }
    }
  }

  console.log(`\nتم: نقل ${moved} سجل، حذف ${deletedDup} مكرر.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
