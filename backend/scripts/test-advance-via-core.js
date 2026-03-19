/**
 * اختبار السلفية عبر FinancialCoreService — المسار الموحد
 *
 * يُثبت أن السلفيات تمر عبر المحرك المالي المركزي فقط.
 * التشغيل: node backend/scripts/test-advance-via-core.js
 * (يتطلب تشغيل السيرفر أو استخدام ApplicationContext)
 *
 * بديل: استخدم الاختبارات الآلية في financial-core.e2e-spec.ts
 */
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const { FinancialCoreService } = require('../src/financial-core/financial-core.service');
const { TenantContext } = require('../src/common/tenant-context');
const { TenantPrismaService } = require('../src/prisma/tenant-prisma.service');

async function main() {
  const { AppModule } = require('../src/app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const prisma = app.get(TenantPrismaService);
  const core = app.get(FinancialCoreService);

  const company = await prisma.company.findFirst({ where: { isArchived: false } });
  if (!company) throw new Error('لا توجد شركة — شغّل الـ seed أولاً');

  const employee = await prisma.employee.findFirst({ where: { companyId: company.id } });
  if (!employee) throw new Error('لا يوجد موظف — شغّل الـ seed أولاً');

  const vault = await prisma.vault.findFirst({ where: { companyId: company.id, isActive: true } });
  if (!vault) throw new Error('لا توجد خزنة نشطة');

  const user = await prisma.user.findFirst({ where: { tenantId: company.tenantId } });

  const ADVANCE_AMOUNT = '1000';
  const txDate = new Date().toISOString().slice(0, 10);
  const invoiceNumber = `ADV-${Date.now().toString().slice(-8)}`;

  const result = await new Promise((resolve, reject) => {
    TenantContext.run(company.tenantId, user?.id ?? null, () => {
      core
        .processOutflow(
          {
            companyId: company.id,
            employeeId: employee.id,
            invoiceNumber,
            kind: 'advance',
            totalAmount: ADVANCE_AMOUNT,
            netAmount: ADVANCE_AMOUNT,
            taxAmount: '0',
            transactionDate: txDate,
            vaultId: vault.id,
          },
          user?.id,
        )
        .then(resolve)
        .catch(reject);
    });
  });

  console.log('\n✅ السلفية نُفذت عبر FinancialCoreService:');
  console.log('  رقم الفاتورة:', result.invoice.invoiceNumber);
  console.log('  المبلغ:', result.invoice.totalAmount, '﷼');
  console.log('  employeeId:', result.invoice.employeeId);
  console.log('  نوع القيد:', result.ledgerEntry.referenceType);

  await app.close();
}

main().catch((e) => {
  console.error('❌ خطأ:', e.message);
  process.exit(1);
});
