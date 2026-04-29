/**
 * زرع سجل HAJRI TAX (VatPlanningQuarter) لأرباع سابقة — أرقام من إقرارات أرشيفية (2025 Q3 / Q4).
 *
 * يطابق الشركات بالاسم (ARZ، دوحة المستهلك، وقت الكرك، المعلم الشامي). إن لم تُوجد شركة، يُتخطى الصف مع تحذير.
 *
 * التشغيل من مجلد backend:
 *   node prisma/seed-vat-planning-history.js
 *
 * يتطلب DATABASE_URL (مثل باقي أوامر Prisma).
 */
const path = require('path');
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {
  /* optional */
}

const { PrismaClient } = require('@prisma/client');
const { pickCompanyForHajriKey } = require('./lib/hajri-resolve-company.cjs');

const prisma = new PrismaClient();

/** أرقام الجدول المرجعي — المبيعات / المشتريات / ضريبة المخرجات / ضريبة المدخلات (صافي الضريبة محسوبة) */
const ARCHIVE_ROWS = [
  // Q4 2025
  {
    key: 'ARZ',
    year: 2025,
    quarter: 4,
    sales: 434092.17,
    purchases: 381758.84,
    outputVat: 65113.83,
    inputVat: 57263.83,
  },
  {
    key: 'دوحة المستهلك',
    year: 2025,
    quarter: 4,
    sales: 258345.83,
    purchases: 240679.16,
    outputVat: 38751.87,
    inputVat: 36101.87,
  },
  {
    key: 'وقت الكرك',
    year: 2025,
    quarter: 4,
    sales: 154206.09,
    purchases: 147306.09,
    outputVat: 23130.91,
    inputVat: 22095.91,
  },
  {
    key: 'المعلم الشامي',
    year: 2025,
    quarter: 4,
    sales: 592483.2,
    purchases: 540056.53,
    outputVat: 88872.48,
    inputVat: 81008.48,
  },
  // Q3 2025
  {
    key: 'ARZ',
    year: 2025,
    quarter: 3,
    sales: 237714.0,
    purchases: 205753.0,
    outputVat: 35657.1,
    inputVat: 30862.95,
  },
  {
    key: 'دوحة المستهلك',
    year: 2025,
    quarter: 3,
    sales: 259295.0,
    purchases: 235682.0,
    outputVat: 38894.25,
    inputVat: 35352.3,
  },
  {
    key: 'وقت الكرك',
    year: 2025,
    quarter: 3,
    sales: 136328.0,
    purchases: 130584.0,
    outputVat: 20449.2,
    inputVat: 19587.6,
  },
  {
    key: 'المعلم الشامي',
    year: 2025,
    quarter: 3,
    sales: 830344.0,
    purchases: 775023.0,
    outputVat: 124551.6,
    inputVat: 116253.45,
  },
];

function buildPayload(row) {
  const out = row.outputVat;
  const inn = row.inputVat;
  const netVat = Math.round((out - inn) * 100) / 100;
  return {
    standard_sales: { amount: row.sales, adjustment: 0, vat: out },
    standard_purchases: { amount: row.purchases, adjustment: 0, vat: inn },
    vat_due: out,
    vat_recoverable: inn,
    net_vat: netVat,
    prior_adjustments: 0,
    balance_carried: 0,
    net_payable_refund: netVat,
  };
}

async function resolveCompany(rowKey) {
  const companies = await prisma.company.findMany({
    select: { id: true, tenantId: true, nameAr: true, nameEn: true, isArchived: true },
  });
  return pickCompanyForHajriKey(rowKey, companies);
}

async function main() {
  console.log('🧾 زرع سجل الضريبة التخطيطي (HAJRI) — 2025 Q3 & Q4 …\n');

  let upserted = 0;
  let skipped = 0;

  for (const row of ARCHIVE_ROWS) {
    const company = await resolveCompany(row.key);
    if (!company) {
      console.warn(`⚠️  تخطي — لم تُعثر على شركة مطابقة لـ «${row.key}»`);
      skipped += 1;
      continue;
    }

    const payload = buildPayload(row);
    const netPayable = payload.net_payable_refund;
    const notes = 'أرشيف إقرار مقدَّم — زرع تلقائي من أرقام مرجعية';

    await prisma.vatPlanningQuarter.upsert({
      where: {
        companyId_year_quarter: {
          companyId: company.id,
          year: row.year,
          quarter: row.quarter,
        },
      },
      create: {
        tenantId: company.tenantId,
        companyId: company.id,
        year: row.year,
        quarter: row.quarter,
        payload,
        paymentTarget: netPayable,
        notes,
        sourceSnapshot: {
          source: 'seed-vat-planning-history',
          referenceKey: row.key,
          sales: row.sales,
          purchases: row.purchases,
          outputVat: row.outputVat,
          inputVat: row.inputVat,
        },
      },
      update: {
        payload,
        paymentTarget: netPayable,
        notes,
        sourceSnapshot: {
          source: 'seed-vat-planning-history',
          referenceKey: row.key,
          sales: row.sales,
          purchases: row.purchases,
          outputVat: row.outputVat,
          inputVat: row.inputVat,
        },
      },
    });

    console.log(
      `✅ ${company.nameAr || company.nameEn} — ${row.year} Q${row.quarter} — صافي ${netPayable.toFixed(2)} SR`,
    );
    upserted += 1;
  }

  console.log(`\nتم: ${upserted} سجل، تخطي: ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
