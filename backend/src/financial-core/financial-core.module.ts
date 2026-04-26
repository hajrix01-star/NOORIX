import { Module }                    from '@nestjs/common';
import { FinancialCoreService }      from './financial-core.service';
import { FinancialCoreSupportService } from './financial-core-support.service';
import { FinancialOutflowService }   from './financial-outflow.service';
import { FinancialInflowService }    from './financial-inflow.service';
import { FinancialTransferService }  from './financial-transfer.service';
import { FinancialCancelService }   from './financial-cancel.service';
import { FiscalPeriodModule }        from '../fiscal-period/fiscal-period.module';
import { IdempotencyModule }         from '../idempotency/idempotency.module';
import { VaultBalanceModule }        from '../vault-balance/vault-balance.module';

/**
 * FinancialCoreModule — يُصدَّر كـ Global لأن جميع الوحدات المالية تحتاجه.
 * PrismaModule مُسجَّل كـ @Global، لذا TenantPrismaService متاح تلقائياً.
 */
@Module({
  imports:   [FiscalPeriodModule, IdempotencyModule, VaultBalanceModule],
  providers: [
    FinancialCoreSupportService,
    FinancialOutflowService,
    FinancialInflowService,
    FinancialTransferService,
    FinancialCancelService,
    FinancialCoreService,
  ],
  exports:   [FinancialCoreService],
})
export class FinancialCoreModule {}
