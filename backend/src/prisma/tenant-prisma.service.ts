/**
 * TenantPrismaService — Prisma Client مُدرك للـ Tenant.
 *
 * يحقن `app.current_tenant_id` كـ PostgreSQL session variable قبل كل query،
 * مما يُفعّل سياسات RLS تلقائياً دون أي تغيير في منطق الـ Services.
 *
 * الطريقة:
 * - لكل $transaction: يُنفَّذ SET LOCAL أولاً داخل نفس الـ transaction.
 * - لكل query مفردة: يُستخدم Prisma middleware لحقن SET LOCAL.
 *
 * ملاحظة: SET LOCAL يكون مؤثراً داخل الـ transaction فقط — آمن مع connection pooling.
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient }                              from '@prisma/client';
import { TenantContext }                             from '../common/tenant-context';
import { connectPrismaWithRetry }                    from './prisma-connect-retry';

@Injectable()
export class TenantPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** مهلة الـ transaction: 30 ثانية — الافتراضي 5s لا يكفي مع RLS + Audit + شبكة */
  static readonly TX_TIMEOUT_MS = 30_000;

  private readonly connectLogger = new Logger(TenantPrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }]
        : [{ level: 'error', emit: 'event' }],
      transactionOptions: {
        timeout: TenantPrismaService.TX_TIMEOUT_MS,
        maxWait: 10_000,
      },
    });

    // ── Middleware: حقن tenant_id قبل كل query ──────────────
    // يُستخدم فقط للـ queries المفردة خارج $transaction.
    // داخل $transaction، يتم الحقن يدوياً عبر withTenant().
    //
    // ⚠️ IMPORTANT: يجب تخطي executeRaw/queryRaw لمنع infinite recursion،
    // لأن $use يعترض $executeRaw أيضاً في Prisma.
    this.$use(async (params, next) => {
      // تخطي Raw operations لمنع الحلقة اللانهائية
      if (
        params.action === 'executeRaw' ||
        params.action === 'queryRaw'   ||
        params.action === 'runCommandRaw'
      ) {
        return next(params);
      }

      if (TenantContext.shouldSkipSetConfig()) return next(params);
      if (TenantContext.hasContext()) {
        const tenantId = TenantContext.getTenantId();
        // set_config مع false (session-level) للـ queries خارج transaction
        await (this as PrismaClient).$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantId ?? ''}, false)
        `;
      }
      return next(params);
    });
  }

  async onModuleInit() {
    try {
      await connectPrismaWithRetry(() => this.$connect(), TenantPrismaService.name);
      this.connectLogger.log('اتصال TenantPrisma (RLS) نجح');
    } catch (err) {
      this.connectLogger.error('فشل اتصال TenantPrisma بعد كل المحاولات:', err);
      throw err;
    }
  }
  async onModuleDestroy() { await this.$disconnect(); }

  /**
   * تنفيذ عملية ذرية (Atomic) مع ضمان tenant context في كل الـ transaction.
   *
   * @example
   * return this.tenantPrisma.withTenant(async (tx) => {
   *   const invoice = await tx.invoice.create({ ... });
   *   await tx.ledgerEntry.create({ ... });
   *   return invoice;
   * });
   */
  async withTenant<T>(fn: (tx: Omit<TenantPrismaService, 'withTenant' | '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
    const tenantId = TenantContext.getTenantId();

    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantId}, true)
        `;
        TenantContext.setSkipSetConfigForTransaction(true);
        try {
          return await fn(tx as unknown as Omit<TenantPrismaService, 'withTenant' | '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>);
        } finally {
          TenantContext.setSkipSetConfigForTransaction(false);
        }
      },
      { timeout: TenantPrismaService.TX_TIMEOUT_MS, maxWait: 10_000 } as { timeout?: number; maxWait?: number },
    );
  }

  /**
   * تنفيذ query خام مع ضمان tenant context.
   * يُستخدم للـ aggregations التي تحتاج raw SQL.
   */
  async executeWithTenant<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> {
    const tenantId = TenantContext.getTenantId();
    await this.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return this.$queryRaw<T>(query, ...values);
  }
}
