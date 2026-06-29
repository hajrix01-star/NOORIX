import { Module } from '@nestjs/common';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { AccountingCoreService } from './accounting-core.service';

@Module({
  imports: [FinancialCoreModule],
  providers: [AccountingCoreService],
  exports: [AccountingCoreService],
})
export class AccountingCoreModule {}
