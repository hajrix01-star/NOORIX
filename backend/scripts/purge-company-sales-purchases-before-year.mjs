/**
 * معاينة أو إلغاء محاسبي (لا حذف صفوف) لملخصات مبيعات وفواتير مشتريات قبل سنة محددة.
 *
 * يطابق منطق الإلغاء في التطبيق تقريباً: status → cancelled + قيود ledger + سجل تدقيق.
 *
 * الاستخدام (من مجلد backend):
 *   node scripts/purge-company-sales-purchases-before-year.mjs --dry-run
 *   node scripts/purge-company-sales-purchases-before-year.mjs --dry-run --company-name="وقت الكرك"
 *   node scripts/purge-company-sales-purchases-before-year.mjs --execute --i-confirm --company-id=clxxx...
 *
 * متغيرات اختيارية:
 *   --year=2026          (افتراضي: 2026 → يلغي ما قبل 2026-01-01 بتوقيت UTC)
 *   --tenant-id=...      tenant للـ RLS (افتراضي: env APP_TENANT_ID أو default-tenant-noorix-2024)
 *   --company-name=...   جزء من name_ar (case-insensitive)
 *   --company-id=...     معرّف الشركة بدقة (يُفضّل مع --execute)
 *
 * ⚠️ شغّل --dry-run أولاً وانسخ المخرجات للمراجعة. --execute لا يعمل بدون --i-confirm.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  try {
    fs.readFileSync(p, 'utf8').split('\n').forEach((l) => {
      const [k, ...v] = l.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    });
  } catch {
    /* no .env */
  }
}

function argVal(name, def) {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  if (hit) return hit.slice(p.length);
  return def;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function ymd(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function money(v) {
  if (v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

async function setTenantSession(prisma, tenantId, isLocal = false) {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, ${isLocal})`;
}

async function main() {
  loadEnv();
  const dryRun = !hasFlag('execute');
  const year = Math.max(2000, parseInt(argVal('year', '2026'), 10) || 2026);
  const cutoff = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const companyNameNeedle = argVal('company-name', 'كرك');
  const companyIdArg = argVal('company-id', '') || null;
  const tenantIdArg =
    argVal('tenant-id', '') || process.env.APP_TENANT_ID || 'default-tenant-noorix-2024';

  if (!dryRun && !hasFlag('i-confirm')) {
    console.error('رفض التنفيذ: أضف --i-confirm مع --execute');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await setTenantSession(prisma, tenantIdArg, false);

    let company;
    if (companyIdArg) {
      company = await prisma.company.findFirst({
        where: { id: companyIdArg, isArchived: false },
        select: { id: true, nameAr: true, nameEn: true, tenantId: true },
      });
    } else {
      const list = await prisma.company.findMany({
        where: {
          isArchived: false,
          nameAr: { contains: companyNameNeedle, mode: 'insensitive' },
        },
        select: { id: true, nameAr: true, nameEn: true, tenantId: true },
        take: 20,
      });
      if (list.length === 0) {
        console.error(`لم يُعثر على شركة name_ar يحتوي "${companyNameNeedle}". جرّب --company-id=`);
        process.exit(1);
      }
      if (list.length > 1) {
        console.error('عدة شركات مطابقة — حدّد --company-id= بدقة:\n');
        for (const c of list) console.error(`  ${c.id}\t${c.nameAr}\t${c.nameEn || ''}`);
        process.exit(1);
      }
      company = list[0];
    }

    if (!company) {
      console.error('الشركة غير موجودة.');
      process.exit(1);
    }

    await setTenantSession(prisma, company.tenantId, false);

    const actor = await prisma.user.findFirst({
      where: { tenantId: company.tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, nameAr: true },
    });
    const actorUserId = actor?.id || null;
    if (!actorUserId && !dryRun) {
      console.error('لا يوجد مستخدم نشط في المستأجر لتسجيل التدقيق. أوقف التنفيذ.');
      process.exit(1);
    }

    const salesWhere = {
      companyId: company.id,
      status: 'active',
      transactionDate: { lt: cutoff },
    };

    const purchaseWhere = {
      companyId: company.id,
      status: 'active',
      kind: 'purchase',
      transactionDate: { lt: cutoff },
    };

    const [sales, purchases, salesCount, purchasesCount] = await Promise.all([
      prisma.dailySalesSummary.findMany({
        where: salesWhere,
        orderBy: { transactionDate: 'asc' },
        select: {
          id: true,
          summaryNumber: true,
          transactionDate: true,
          totalAmount: true,
          notes: true,
        },
      }),
      prisma.invoice.findMany({
        where: purchaseWhere,
        orderBy: { transactionDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          transactionDate: true,
          totalAmount: true,
          notes: true,
        },
      }),
      prisma.dailySalesSummary.count({ where: salesWhere }),
      prisma.invoice.count({ where: purchaseWhere }),
    ]);

    console.log('\n========== معاينة إلغاء قبل ' + year + ' ==========');
    console.log('الشركة:', company.nameAr, '| id:', company.id);
    console.log('حد التاريخ (أقل من):', cutoff.toISOString());
    console.log('مستخدم التدقيق:', actor ? `${actor.email} (${actor.id})` : '(لا يوجد)');
    console.log('وضع التشغيل:', dryRun ? 'DRY-RUN فقط — لن يُغيّر شيئاً' : 'EXECUTE — سيتم الإلغاء');
    console.log('');

    console.log('--- ملخصات مبيعات (active) ---');
    console.log('العدد:', salesCount);
    for (const r of sales) {
      console.log(
        [r.summaryNumber, ymd(r.transactionDate), money(r.totalAmount), (r.notes || '').slice(0, 60)].join('\t'),
      );
    }

    console.log('\n--- فواتير مشتريات (active) ---');
    console.log('العدد:', purchasesCount);
    for (const r of purchases) {
      console.log(
        [r.invoiceNumber, ymd(r.transactionDate), money(r.totalAmount), (r.notes || '').slice(0, 60)].join('\t'),
      );
    }

    console.log('\n========================================\n');

    if (dryRun) {
      console.log('للتنفيذ بعد المراجعة:');
      console.log(
        `  node scripts/purge-company-sales-purchases-before-year.mjs --execute --i-confirm --company-id=${company.id} --year=${year}`,
      );
      return;
    }

    const entryDate = new Date();
    let okS = 0;
    let okP = 0;
    let err = 0;

    for (const s of sales) {
      try {
        await prisma.$transaction(async (tx) => {
          await setTenantSession(tx, company.tenantId, true);
          const summary = await tx.dailySalesSummary.findFirst({
            where: { id: s.id, companyId: company.id, status: 'active' },
            include: { saleInvoice: true },
          });
          if (!summary) return;
          await tx.dailySalesSummary.update({
            where: { id: s.id },
            data: { status: 'cancelled' },
          });
          if (summary.saleInvoice) {
            await tx.invoice.update({
              where: { id: summary.saleInvoice.id },
              data: { status: 'cancelled' },
            });
          }
          await tx.ledgerEntry.updateMany({
            where: {
              companyId: company.id,
              referenceType: 'sale',
              referenceId: s.id,
              status: 'active',
            },
            data: { status: 'cancelled' },
          });
          await tx.auditLog.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              userId: actorUserId,
              action: 'cancel',
              entity: 'sale',
              entityId: s.id,
              oldValue: { summaryNumber: summary.summaryNumber, status: 'active' },
              newValue: {
                summaryNumber: summary.summaryNumber,
                status: 'cancelled',
                reason: `purge script before ${year}`,
              },
              createdAt: entryDate,
            },
          });
        });
        okS++;
      } catch (e) {
        err++;
        console.error('فشل إلغاء ملخص', s.summaryNumber, e.message || e);
      }
    }

    for (const inv of purchases) {
      try {
        await prisma.$transaction(async (tx) => {
          await setTenantSession(tx, company.tenantId, true);
          const row = await tx.invoice.findFirst({
            where: { id: inv.id, companyId: company.id, status: 'active' },
          });
          if (!row) return;
          await tx.invoice.update({
            where: { id: inv.id },
            data: { status: 'cancelled' },
          });
          await tx.ledgerEntry.updateMany({
            where: {
              companyId: company.id,
              referenceType: 'invoice',
              referenceId: inv.id,
              status: 'active',
            },
            data: { status: 'cancelled' },
          });
          await tx.auditLog.create({
            data: {
              tenantId: company.tenantId,
              companyId: company.id,
              userId: actorUserId,
              action: 'cancel',
              entity: 'invoice',
              entityId: inv.id,
              oldValue: { invoiceNumber: row.invoiceNumber, kind: row.kind, status: 'active' },
              newValue: {
                invoiceNumber: row.invoiceNumber,
                kind: row.kind,
                status: 'cancelled',
                reason: `purge script before ${year}`,
              },
              createdAt: entryDate,
            },
          });
        });
        okP++;
      } catch (e) {
        err++;
        console.error('فشل إلغاء فاتورة', inv.invoiceNumber, e.message || e);
      }
    }

    console.log('تم الإلغاء — ملخصات مبيعات:', okS, '| مشتريات:', okP, '| أخطاء:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
