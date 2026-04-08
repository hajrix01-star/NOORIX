/**
 * إلغاء فواتير راتب مسيرة رواتب (صرف مسيرة) + عكس تسويات السلف المرتبطة + حذف سجل المسيرة.
 *
 * الاستخدام (من مجلد backend):
 *   COMPANY_MATCH=ARZ PAYROLL_YEAR=2026 PAYROLL_MONTH=3 node prisma/delete-payroll-run-company-month.js
 *   COMPANY_ID=cmxxx... PAYROLL_YEAR=2026 PAYROLL_MONTH=3 node prisma/delete-payroll-run-company-month.js
 *
 * COMPANY_ID: (اختياري) معرّف الشركة — يتجاوز COMPANY_MATCH
 * COMPANY_MATCH: مطابقة جزئية لـ name_ar أو name_en (غير حساسة لحالة الأحرف)
 * PAYROLL_MONTH: 1..12
 * PAYROLL_YEAR: سنة أول يوم الشهر في المسيرة (مثلاً 2026 لمارس 2026)
 */
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

const COMPANY_ID = (process.env.COMPANY_ID || '').trim();
const COMPANY_MATCH = (process.env.COMPANY_MATCH || 'ARZ').trim();
const PAYROLL_YEAR = Number(process.env.PAYROLL_YEAR || '2026');
const PAYROLL_MONTH = Number(process.env.PAYROLL_MONTH || '3');

function monthRangeUtc(year, month1to12) {
  const m = month1to12 - 1;
  const start = new Date(Date.UTC(year, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, m + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

function stripAdvPayrollLines(notes, runNumber) {
  const esc = runNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(notes || '')
    .split('\n')
    .filter((line) => !new RegExp(`^\\[ADV_PAYROLL\\] run=${esc},`).test(line.trim()))
    .join('\n')
    .trim();
}

async function main() {
  if (!COMPANY_ID && !COMPANY_MATCH) {
    console.error('❌ عيّن COMPANY_ID أو COMPANY_MATCH');
    process.exit(1);
  }
  if (!Number.isFinite(PAYROLL_YEAR) || !Number.isFinite(PAYROLL_MONTH) || PAYROLL_MONTH < 1 || PAYROLL_MONTH > 12) {
    console.error('❌ PAYROLL_YEAR / PAYROLL_MONTH غير صالح');
    process.exit(1);
  }

  let company;
  if (COMPANY_ID) {
    const c = await prisma.company.findUnique({
      where: { id: COMPANY_ID },
      select: { id: true, nameAr: true, nameEn: true },
    });
    if (!c) {
      console.error(`❌ COMPANY_ID غير موجود: ${COMPANY_ID}`);
      process.exit(1);
    }
    company = c;
  } else {
    const needle = COMPANY_MATCH.toLowerCase();
    const all = await prisma.company.findMany({
      select: { id: true, nameAr: true, nameEn: true },
    });
    const companies = all.filter((c) => {
      const ar = (c.nameAr || '').toLowerCase();
      const en = (c.nameEn || '').toLowerCase();
      return ar.includes(needle) || en.includes(needle);
    });

    if (companies.length === 0) {
      console.log(`✅ لا توجد شركة تطابق «${COMPANY_MATCH}».`);
      return;
    }
    if (companies.length > 1) {
      console.error('❌ أكثر من شركة تطابق الاسم. صغّر COMPANY_MATCH أو استخدم COMPANY_ID:');
      for (const c of companies) console.error(`   - ${c.nameAr} / ${c.nameEn} (${c.id})`);
      process.exit(1);
    }
    company = companies[0];
  }
  const { start, end } = monthRangeUtc(PAYROLL_YEAR, PAYROLL_MONTH);

  const runs = await prisma.payrollRun.findMany({
    where: {
      companyId: company.id,
      payrollMonth: { gte: start, lt: end },
    },
    orderBy: { payrollMonth: 'asc' },
  });

  if (runs.length === 0) {
    console.log(
      `✅ لا توجد مسيرة رواتب لـ ${company.nameAr} (${company.nameEn || '—'}) للشهر ${PAYROLL_MONTH}/${PAYROLL_YEAR}.`,
    );
    return;
  }
  if (runs.length > 1) {
    console.error(`❌ وُجدت ${runs.length} مسيرات لنفس الشهر. راجع البيانات يدوياً:`);
    for (const r of runs) console.error(`   - ${r.runNumber} (${r.id}) status=${r.status}`);
    process.exit(1);
  }

  const run = runs[0];
  console.log(`\n📋 شركة: ${company.nameAr} (${company.nameEn || '—'})`);
  console.log(`📋 مسيرة: ${run.runNumber} | ${run.id} | status=${run.status} | شهر=${run.payrollMonth.toISOString()}\n`);

  await prisma.$transaction(async (tx) => {
    const deductions = await tx.employeeDeduction.findMany({
      where: {
        companyId: company.id,
        deductionType: 'advance',
        notes: { contains: `مسير ${run.runNumber}` },
      },
    });

    for (const d of deductions) {
      if (!d.referenceId) continue;
      const inv = await tx.invoice.findFirst({
        where: { id: d.referenceId, companyId: company.id, kind: 'advance' },
      });
      if (!inv) continue;

      const prevSettled = Number(inv.settledAmount ?? 0);
      const deductAmt = Number(d.amount);
      const newSettled = Math.max(0, prevSettled - deductAmt);
      const total = Number(inv.totalAmount ?? 0);
      const newNotes = stripAdvPayrollLines(inv.notes, run.runNumber);
      const eps = 0.02;

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          settledAmount: new Prisma.Decimal(newSettled),
          settledAt: newSettled >= total - eps ? inv.settledAt : null,
          notes: newNotes || null,
        },
      });
    }

    if (deductions.length) {
      await tx.employeeDeduction.deleteMany({
        where: {
          companyId: company.id,
          deductionType: 'advance',
          notes: { contains: `مسير ${run.runNumber}` },
        },
      });
      console.log(`   عُكست ${deductions.length} خصماً مرتبطاً بالمسيرة على فواتير السلف.`);
    }

    const salaryInvoices = await tx.invoice.findMany({
      where: {
        companyId: company.id,
        batchId: run.id,
        kind: 'salary',
      },
    });

    for (const inv of salaryInvoices) {
      if (inv.status === 'cancelled') continue;
      await tx.invoice.update({
        where: { id: inv.id },
        data: { status: 'cancelled' },
      });
      const led = await tx.ledgerEntry.updateMany({
        where: {
          companyId: company.id,
          referenceType: 'salary',
          referenceId: inv.id,
          status: 'active',
        },
        data: { status: 'cancelled' },
      });
      console.log(`   أُلغيت فاتورة راتب ${inv.invoiceNumber} (${inv.id}) — قيود ملغاة: ${led.count}`);
    }

    if (!salaryInvoices.length) {
      console.log('   (لا فواتير راتب برمز batch_id = مسيرة — ربما لم يُصرف بعد)');
    }

    await tx.payrollRun.delete({ where: { id: run.id } });
    console.log(`\n✅ حُذفت مسيرة ${run.runNumber} وجميع بنودها.\n`);
  });
}

main()
  .catch((e) => {
    console.error('❌ فشل:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
