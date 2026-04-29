import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { config } from 'dotenv';
import { resolve } from 'path';
import Decimal from 'decimal.js';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancialCoreModule } from './financial-core.module';
import { FinancialCoreService } from './financial-core.service';
import { ReportsService } from '../reports/reports.service';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

config({ path: resolve(__dirname, '../../.env') });

const RUN = Boolean(process.env.DATABASE_URL && process.env.FINANCIAL_INTEGRATION_TEST === '1');

const describeIntegration = RUN ? describe : describe.skip;

function inTenantContext<T>(tenantId: string, userId: string, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    TenantContext.run(tenantId, userId, () => {
      void fn().then(resolve, reject);
    });
  });
}

function d(s: string): Decimal {
  return new Decimal(String(s).replace(/,/g, ''));
}

function localYmd(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

describeIntegration('المحرك المالي — مشتريات / مبيعات / تحويل / إلغاء / P&L', () => {
  let core: FinancialCoreService;
  let reports: ReportsService;
  let prisma: TenantPrismaService;
  let app: { close: () => Promise<void> };
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let year: number;
  let txDateBootstrap: string;
  let txDateSales: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, FinancialCoreModule],
      providers: [ReportsService],
    }).compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    app = nest;
    core = nest.get(FinancialCoreService);
    reports = nest.get(ReportsService);
    prisma = nest.get(TenantPrismaService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('إنشاء فاتورة مشتريات، مبيعات يوم، تحويل، إلغاء — وتطابق P&L مع القيود/القواعد', async () => {
    const company = await prisma.company.findFirst({
      where: { isArchived: false },
      include: { tenant: true },
    });
    if (!company?.tenant) throw new Error('تشغيل: prisma db seed ثم اضبط DATABASE_URL');

    const user = await prisma.user.findFirst({
      where: { tenantId: company.tenantId, isActive: true },
    });
    if (!user) throw new Error('لا يوجد مستخدم — شغّل الـ seed');

    const tBoot = new Date();
    tBoot.setDate(tBoot.getDate() - 7);
    const tSales = new Date();
    tSales.setDate(tSales.getDate() - 3);
    txDateBootstrap = localYmd(tBoot);
    txDateSales = localYmd(tSales);
    year = new Date(`${txDateBootstrap}T12:00:00`).getFullYear();
    const vaults = await prisma.vault.findMany({
      where: { companyId: company.id, isActive: true, isArchived: false, showAsPaymentMethod: true },
      orderBy: { createdAt: 'asc' },
    });
    if (vaults.length < 2) {
      throw new Error('نحتاج خزنتان على الأقل (كاش+بنك) — شغّل الـ seed');
    }
    const [cash, bank] = [vaults[0]!.id, vaults[1]!.id];
    const tenantId = company.tenantId;
    const userId = user.id;
    const companyId = company.id;

    // ── 1) تسجيل مبيعات (تموين خزنة النقد) ──
    await inTenantContext(tenantId, userId, () =>
      core.processInflow(
        {
          companyId,
          transactionDate: txDateBootstrap,
          channels: [{ vaultId: cash, amount: '10000' }],
          notes: 'integration: bootstrap cash',
          idempotencyKey: `it-${runId}-bootstrap`,
        },
        userId,
      ),
    );

    const pl0 = await reports.getGeneralProfitLoss(companyId, year);

    // ── 2) فاتورة مشتريات ──
    const { invoice: invPurchase } = await inTenantContext(tenantId, userId, () =>
      core.processOutflow(
        {
          companyId,
          kind: 'purchase',
          totalAmount: '1000',
          netAmount: '1000',
          taxAmount: '0',
          transactionDate: txDateBootstrap,
          vaultId: cash,
          notes: 'integration: purchase',
          idempotencyKey: `it-${runId}-purchase`,
        },
        userId,
      ),
    );
    expect(invPurchase.kind).toBe('purchase');
    expect(String(invPurchase.totalAmount)).toBe('1000');

    const pl1 = await reports.getGeneralProfitLoss(companyId, year);
    expect(d(pl1.cards.purchases).minus(d(pl0.cards.purchases)).toFixed(2)).toBe('1000.00');
    // تحويل بين خزن لا يغيّر P&L — يُتأكد لاحقاً
    // ── 3) مبيعات يوم ──
    await inTenantContext(tenantId, userId, () =>
      core.processInflow(
        {
          companyId,
          transactionDate: txDateSales,
          channels: [{ vaultId: cash, amount: '500' }],
          notes: 'integration: day sales',
          idempotencyKey: `it-${runId}-sales`,
        },
        userId,
      ),
    );
    const pl2 = await reports.getGeneralProfitLoss(companyId, year);
    expect(d(pl2.cards.sales).minus(d(pl1.cards.sales)).toFixed(2)).toBe('500.00');
    // أرقام P&L متسقة داخلية (بطاقة / صافي = مبيعات − مشتريات − مصاريف)
    const s = d(pl2.cards.sales);
    const p = d(pl2.cards.purchases);
    const e = d(pl2.cards.expenses);
    const g = d(pl2.cards.grossProfit);
    const n = d(pl2.cards.netProfit);
    expect(g.toFixed(2)).toBe(s.minus(p).toFixed(2));
    expect(n.toFixed(2)).toBe(g.minus(e).toFixed(2));

    // ── 4) تحويل بين خزن ـ دون تغيير P&L ──
    await inTenantContext(tenantId, userId, () =>
      core.processTransfer(
        {
          companyId,
          fromVaultId: cash,
          toVaultId: bank,
          amount: '200',
          transactionDate: txDateSales,
          notes: 'integration: transfer',
          idempotencyKey: `it-${runId}-transfer`,
        },
        userId,
      ),
    );
    const pl3 = await reports.getGeneralProfitLoss(companyId, year);
    expect(pl3.cards).toEqual(pl2.cards);

    // ── 5) إلغاء فاتورة المشتريات — الرجوع لأرقام المشتريات قبل الصرف
    await inTenantContext(tenantId, userId, () =>
      core.cancelOperation(
        {
          companyId,
          referenceType: 'invoice',
          referenceId: invPurchase.id,
          reason: 'integration: cancel purchase',
        },
        userId,
      ),
    );
    const pl4 = await reports.getGeneralProfitLoss(companyId, year);
    expect(pl4.cards.purchases).toBe(pl0.cards.purchases);
    // المبيعات لا تزال مع الملخص
    expect(pl4.cards.sales).toBe(pl2.cards.sales);
    // الاستدعاة المتتابعة دون تغيير — نفس الأرقام
    const plAgain = await reports.getGeneralProfitLoss(companyId, year);
    expect(pl4.cards).toEqual(plAgain.cards);
  });
});
