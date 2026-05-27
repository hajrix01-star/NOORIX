/**
 * توزيع ملخص مبيعات شهري (مُدخل في آخر يوم من الشهر) على كل أيام الشهر بالتساوي.
 *
 * الاستخدام (من مجلد backend، بعد npm run build):
 *   node scripts/distribute-monthly-sales-lump-to-days.mjs --dry-run --company-name=ARZ --from=2025-09 --to=2026-02
 *   node scripts/distribute-monthly-sales-lump-to-days.mjs --execute --i-confirm --company-id=...
 *
 * خيارات:
 *   --from=2025-09        بداية الشهر (شامل)
 *   --to=2026-02          نهاية الشهر (شامل)
 *   --company-id=         معرّف الشركة
 *   --company-name=       جزء من name_ar
 *   --force               تجاوز تحذير وجود مبيعات في أيام أخرى من الشهر
 *   --tenant-id=          للـ RLS (افتراضي من env)
 *
 * المنطق:
 *   1) يجمع الملخصات النشطة في آخر يوم من كل شهر
 *   2) يُلغيها محاسبياً (cancel — لا حذف)
 *   3) يُنشئ ملخصاً يومياً لكل يوم في الشهر بمبالغ = الإجمالي ÷ عدد الأيام (الباقي على الأيام الأولى)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import Decimal from 'decimal.js';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

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

function argVal(name, def = '') {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : def;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/** مطابقة toYmd في الخادم */
function toYmd(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s ? s.slice(0, 10) : '';
}

function parseYm(ym) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(ym).trim());
  if (!m) throw new Error(`صيغة شهر غير صالحة: ${ym} (مثال 2025-09)`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`شهر غير صالح: ${ym}`);
  return { year, month };
}

function* monthsBetween(fromYm, toYm) {
  let { year: y, month: m } = fromYm;
  const endY = toYm.year;
  const endM = toYm.month;
  while (y < endY || (y === endY && m <= endM)) {
    yield { year: y, month: m };
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function lastDayYmd(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function dayYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthRangeUtc(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start, end };
}

function money(v) {
  if (v == null) return '0';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/** تقسيم مبلغ إلى n جزء — مجموع الأجزاء = الأصل (هللات على الأيام الأولى) */
function splitEven(total, parts) {
  const n = Math.max(1, parts);
  const t = new Decimal(total);
  const base = t.div(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const out = Array.from({ length: n }, () => base);
  let rem = t.minus(base.times(n));
  let i = 0;
  while (rem.gt(0) && i < n) {
    out[i] = out[i].plus(new Decimal('0.01'));
    rem = rem.minus('0.01');
    i += 1;
  }
  return out.map((d) => d.toFixed(2));
}

function splitInt(total, parts) {
  const n = Math.max(1, parts);
  const t = Math.max(0, Math.trunc(Number(total) || 0));
  const base = Math.floor(t / n);
  let rem = t - base * n;
  const out = Array(n).fill(base);
  let i = 0;
  while (rem > 0 && i < n) {
    out[i] += 1;
    rem -= 1;
    i += 1;
  }
  return out;
}

async function setTenantSession(prisma, tenantId, isLocal = false) {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, ${isLocal})`;
}

async function resolveCompany(prisma, companyIdArg, companyNameNeedle) {
  if (companyIdArg) {
    return prisma.company.findFirst({
      where: { id: companyIdArg, isArchived: false },
      select: { id: true, nameAr: true, nameEn: true, tenantId: true },
    });
  }
  const list = await prisma.company.findMany({
    where: {
      isArchived: false,
      nameAr: { contains: companyNameNeedle, mode: 'insensitive' },
    },
    select: { id: true, nameAr: true, nameEn: true, tenantId: true },
    take: 20,
  });
  if (list.length === 0) {
    throw new Error(`لم تُعثر على شركة تحتوي الاسم "${companyNameNeedle}". استخدم --company-id=`);
  }
  if (list.length > 1) {
    console.error('عدة شركات — حدّد --company-id=:\n');
    for (const c of list) console.error(`  ${c.id}\t${c.nameAr}`);
    process.exit(1);
  }
  return list[0];
}

async function loadNest() {
  const distModule = path.join(__dirname, '..', 'dist', 'app.module.js');
  if (!fs.existsSync(distModule)) {
    throw new Error('شغّل npm run build داخل مجلد backend قبل --execute');
  }
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { FinancialCoreService } = require('../dist/financial-core/financial-core.service');
  const { TenantContext } = require('../dist/common/tenant-context');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const core = app.get(FinancialCoreService);
  return { app, core, TenantContext };
}

async function fetchMonthSummaries(prisma, companyId, year, month) {
  const { start, end } = monthRangeUtc(year, month);
  return prisma.dailySalesSummary.findMany({
    where: {
      companyId,
      status: 'active',
      transactionDate: { gte: start, lt: end },
    },
    include: {
      channels: { select: { vaultId: true, amount: true } },
    },
    orderBy: { transactionDate: 'asc' },
  });
}

function buildMonthPlan(year, month, summaries, force) {
  const lastYmd = lastDayYmd(year, month);
  const dim = daysInMonth(year, month);
  const onLast = summaries.filter((s) => toYmd(s.transactionDate) === lastYmd);
  const onOther = summaries.filter((s) => toYmd(s.transactionDate) !== lastYmd);

  if (onLast.length === 0) {
    return { skip: true, reason: 'لا ملخص في آخر يوم من الشهر' };
  }
  if (onOther.length > 0 && !force) {
    return {
      skip: true,
      reason: `يوجد ${onOther.length} ملخص(ات) في أيام أخرى — استخدم --force للمتابعة`,
    };
  }

  const channelTotals = new Map();
  let customerTotal = 0;
  let cashTotal = new Decimal(0);

  for (const s of onLast) {
    customerTotal += Number(s.customerCount || 0);
    cashTotal = cashTotal.plus(String(s.cashOnHand ?? 0));
    for (const ch of s.channels) {
      const prev = channelTotals.get(ch.vaultId) ?? new Decimal(0);
      channelTotals.set(ch.vaultId, prev.plus(String(ch.amount ?? 0)));
    }
  }

  const channelIds = [...channelTotals.keys()];
  if (channelIds.length === 0) {
    return { skip: true, reason: 'لا قنوات بيع في ملخص آخر اليوم' };
  }

  const perDayChannels = channelIds.map((vaultId) => ({
    vaultId,
    amounts: splitEven(channelTotals.get(vaultId), dim),
  }));

  const perDayCustomers = splitInt(customerTotal, dim);
  const perDayCash = splitEven(cashTotal, dim);

  const days = [];
  for (let d = 1; d <= dim; d += 1) {
    const channels = perDayChannels
      .map((row) => ({
        vaultId: row.vaultId,
        amount: row.amounts[d - 1],
      }))
      .filter((c) => new Decimal(c.amount).gt(0));

    if (channels.length === 0) continue;

    days.push({
      transactionDate: dayYmd(year, month, d),
      customerCount: perDayCustomers[d - 1],
      cashOnHand: perDayCash[d - 1],
      channels,
    });
  }

  const monthTotal = [...channelTotals.values()].reduce((a, b) => a.plus(b), new Decimal(0));

  return {
    skip: false,
    year,
    month,
    lastYmd,
    dim,
    lumpSummaries: onLast,
    otherSummaries: onOther,
    monthTotal: monthTotal.toFixed(2),
    perDayTotal:
      days.length > 0
        ? days[0].channels.reduce((s, c) => s.plus(c.amount), new Decimal(0)).toFixed(2)
        : '0',
    days,
  };
}

async function main() {
  loadEnv();
  const dryRun = !hasFlag('execute');
  const force = hasFlag('force');
  const fromYm = parseYm(argVal('from', '2025-09'));
  const toYm = parseYm(argVal('to', '2026-02'));
  const companyIdArg = argVal('company-id', '') || null;
  const companyNameNeedle = argVal('company-name', 'ARZ');
  const tenantIdArg = argVal('tenant-id', '') || process.env.APP_TENANT_ID || 'default-tenant-noorix-2024';

  if (!dryRun && !hasFlag('i-confirm')) {
    console.error('للتنفيذ أضف --execute --i-confirm');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let nestApp = null;

  try {
    await prisma.$connect();
    await setTenantSession(prisma, tenantIdArg, false);

    const company = await resolveCompany(prisma, companyIdArg, companyNameNeedle);
    if (!company) {
      console.error('الشركة غير موجودة.');
      process.exit(1);
    }
    await setTenantSession(prisma, company.tenantId, false);

    const actor = await prisma.user.findFirst({
      where: { tenantId: company.tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
    if (!actor?.id && !dryRun) {
      console.error('لا مستخدم نشط للتدقيق.');
      process.exit(1);
    }

    let nest;
    if (!dryRun) {
      nest = await loadNest();
      nestApp = nest.app;
    }

    console.log('\n========== توزيع مبيعات شهرية على أيام الشهر ==========');
    console.log('الشركة:', company.nameAr, '|', company.id);
    console.log('الفترة:', `${fromYm.year}-${String(fromYm.month).padStart(2, '0')}`, '→', `${toYm.year}-${String(toYm.month).padStart(2, '0')}`);
    console.log('الوضع:', dryRun ? 'DRY-RUN (معاينة فقط)' : 'EXECUTE');
    console.log('');

    const plans = [];

    for (const { year, month } of monthsBetween(fromYm, toYm)) {
      const ym = `${year}-${String(month).padStart(2, '0')}`;
      const summaries = await fetchMonthSummaries(prisma, company.id, year, month);
      const plan = buildMonthPlan(year, month, summaries, force);
      plan.ym = ym;
      plans.push(plan);

      console.log(`--- ${ym} (${daysInMonth(year, month)} يوم) ---`);
      if (plan.skip) {
        console.log('  تخطي:', plan.reason);
        continue;
      }
      console.log('  إجمالي الشهر (من آخر يوم):', plan.monthTotal, 'SR');
      console.log('  ملخصات للإلغاء:', plan.lumpSummaries.map((s) => s.summaryNumber).join(', '));
      if (plan.otherSummaries?.length) {
        console.log('  ملخصات أيام أخرى (تُلغى أيضاً مع --force):', plan.otherSummaries.map((s) => s.summaryNumber).join(', '));
      }
      console.log('  مثال يوم 1:', plan.perDayTotal, 'SR | عملاء:', plan.days[0]?.customerCount ?? 0);
      console.log('  أيام للإنشاء:', plan.days.length);
    }

    console.log('\n========================================\n');

    if (dryRun) {
      console.log('للتنفيذ بعد المراجعة:');
      console.log(
        `  node scripts/distribute-monthly-sales-lump-to-days.mjs --execute --i-confirm --company-id=${company.id} --from=${argVal('from', '2025-09')} --to=${argVal('to', '2026-02')}`,
      );
      return;
    }

    const { core, TenantContext } = nest;
    let cancelled = 0;
    let created = 0;

    for (const plan of plans) {
      if (plan.skip) continue;

      const toCancel = [...plan.lumpSummaries, ...(force ? plan.otherSummaries || [] : [])];

      for (const s of toCancel) {
        await new Promise((resolve, reject) => {
          TenantContext.run(company.tenantId, actor.id, () => {
            core
              .cancelOperation(
                {
                  referenceType: 'sale',
                  referenceId: s.id,
                  companyId: company.id,
                  reason: `توزيع شهري على أيام ${plan.ym} — إلغاء ملخص مجمّع`,
                },
                actor.id,
              )
              .then(resolve)
              .catch(reject);
          });
        });
        cancelled += 1;
        console.log('  أُلغي:', s.summaryNumber);
      }

      const noteBase = `موزّع من ملخص شهري ${plan.ym} (${plan.lumpSummaries.map((s) => s.summaryNumber).join(', ')})`;

      for (const day of plan.days) {
        const idempotencyKey = `distribute-lump-${company.id}-${plan.ym}-${day.transactionDate}`;
        await new Promise((resolve, reject) => {
          TenantContext.run(company.tenantId, actor.id, () => {
            core
              .processInflow(
                {
                  companyId: company.id,
                  transactionDate: day.transactionDate,
                  customerCount: day.customerCount,
                  cashOnHand: day.cashOnHand,
                  shift: 'all',
                  channels: day.channels,
                  notes: noteBase,
                  idempotencyKey,
                },
                actor.id,
              )
              .then(resolve)
              .catch(reject);
          });
        });
        created += 1;
      }
      console.log(`  ${plan.ym}: أُنشئ ${plan.days.length} ملخصاً يومياً`);
    }

    console.log('\nتم. أُلغي', cancelled, 'ملخصاً | أُنشئ', created, 'ملخصاً يومياً.\n');
  } finally {
    if (nestApp) await nestApp.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
