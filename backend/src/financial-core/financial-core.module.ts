import { Module }               from '@nestjs/common';
import { FinancialCoreService } from './financial-core.service';
import { FiscalPeriodModule }   from '../fiscal-period/fiscal-period.module';
import { IdempotencyModule }    from '../idempotency/idempotency.module';

/**
 * FinancialCoreModule — يُصدَّر كـ Global لأن جميع الوحدات المالية تحتاجه.
 * PrismaModule مُسجَّل كـ @Global، لذا TenantPrismaService متاح تلقائياً.
 */
@Module({
  imports:   [FiscalPeriodModule, IdempotencyModule],
  providers: [FinancialCoreService],
  exports:   [FinancialCoreService],
})
export class FinancialCoreModule {}
