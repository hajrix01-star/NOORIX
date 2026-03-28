import { Module }               from '@nestjs/common';
import { AuthModule }           from '../auth/auth.module';
import { AuditModule }          from '../audit/audit.module';
import { FinancialCoreModule }  from '../financial-core/financial-core.module';
import { VaultsModule }         from '../vaults/vaults.module';
import { InvoiceController }    from './invoice.controller';
import { InvoiceService }       from './invoice.service';

@Module({
  imports:     [AuthModule, AuditModule, FinancialCoreModule, VaultsModule],
  controllers: [InvoiceController],
  providers:   [InvoiceService],
  exports:     [InvoiceService],
})
export class InvoiceModule {}
