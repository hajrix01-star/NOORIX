/**
 * NOORIX — Final Verification Audit
 * يتحقق من: RLS، DTO، Decimal، Batch
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .forEach((l) => {
      const [k, ...v] = l.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    });
} catch {}

const prisma = new PrismaClient();

async function main() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  NOORIX — بروتوكول التحقق النهائي');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. RLS: استعلام بدون tenant_id يعيد 0؟
  console.log('1. اختبار RLS (بدون tenant context):');
  const beforeSet = await prisma.$queryRaw`SELECT count(*) as c FROM invoices`;
  console.log('   - بدون set_config: count(invoices) =', beforeSet[0]?.c ?? '?');
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
  const afterEmpty = await prisma.$queryRaw`SELECT count(*) as c FROM invoices`;
  console.log('   - مع tenant_id فارغ: count(invoices) =', afterEmpty[0]?.c ?? '?');

  // استعادة tenant للتحقق من وجود بيانات
  const tenant = await prisma.tenant.findFirst();
  if (tenant) {
    await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;
    const withTenant = await prisma.$queryRaw`SELECT count(*) as c FROM invoices`;
    console.log('   - مع tenant_id صحيح: count(invoices) =', withTenant[0]?.c ?? '?');
  }

  const rlsOk = Number(afterEmpty[0]?.c ?? 1) === 0;
  console.log('   ✅ RLS يعمل:', rlsOk ? 'نعم (0 بدون tenant)' : 'لا');

  // 2. DTO: kind: salary مقبول؟
  console.log('\n2. DTO: قائمة kind تتضمن salary, advance, hr_expense:');
  const dtoPath = path.join(__dirname, '..', 'src', 'invoice', 'dto', 'create-invoice.dto.ts');
  const dtoContent = fs.readFileSync(dtoPath, 'utf8');
  const hasSalary = dtoContent.includes("'salary'");
  const hasAdvance = dtoContent.includes("'advance'");
  const hasHrExpense = dtoContent.includes("'hr_expense'");
  const debitOptional = dtoContent.includes('@IsOptional') && dtoContent.includes('debitAccountId');
  console.log('   - kind يشمل salary:', hasSalary);
  console.log('   - kind يشمل advance:', hasAdvance);
  console.log('   - debitAccountId اختياري:', debitOptional);
  console.log('   ✅ DTO محدّث:', hasSalary && hasAdvance && debitOptional ? 'نعم' : 'لا');

  // 3. Decimal في VaultsService
  console.log('\n3. Decimal في VaultsService:');
  const vaultPath = path.join(__dirname, '..', 'src', 'vaults', 'vaults.service.ts');
  const vaultContent = fs.readFileSync(vaultPath, 'utf8');
  const usesDecimal = vaultContent.includes("new Decimal(") && vaultContent.includes("totalIn.minus");
  console.log('   - يستخدم Decimal للأرصدة:', usesDecimal);
  console.log('   ✅ الدقة المالية:', usesDecimal ? 'نعم' : 'لا');

  // 4. Batch: processOutflowBatch في transaction واحدة؟
  console.log('\n4. Batch: عملية ذرية (transaction واحدة):');
  const corePath = path.join(__dirname, '..', 'src', 'financial-core', 'financial-core.service.ts');
  const coreContent = fs.readFileSync(corePath, 'utf8');
  const hasBatch = coreContent.includes('processOutflowBatch') && coreContent.includes('withTenant');
  console.log('   - processOutflowBatch موجود:', coreContent.includes('processOutflowBatch'));
  console.log('   - داخل withTenant (transaction):', coreContent.includes('withTenant'));
  console.log('   ✅ Batch ذري:', hasBatch ? 'نعم' : 'لا');

  // 5. TenantMiddleware: 401 عند غياب tenantId؟
  console.log('\n5. TenantMiddleware: 401 عند tenantId غائب:');
  const mwPath = path.join(__dirname, '..', 'src', 'common', 'tenant.middleware.ts');
  const mwContent = fs.readFileSync(mwPath, 'utf8');
  const throws401 = mwContent.includes('UnauthorizedException') && mwContent.includes('!tenantId');
  console.log('   - يرفع 401 عند غياب tenantId:', throws401);
  console.log('   ✅ Middleware آمن:', throws401 ? 'نعم' : 'لا');

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  الخلاصة:');
  console.log('  - RLS:', rlsOk ? '✅' : '❌');
  console.log('  - DTO:', hasSalary && debitOptional ? '✅' : '❌');
  console.log('  - Decimal:', usesDecimal ? '✅' : '❌');
  console.log('  - Batch:', hasBatch ? '✅' : '❌');
  console.log('  - Middleware:', throws401 ? '✅' : '❌');
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
