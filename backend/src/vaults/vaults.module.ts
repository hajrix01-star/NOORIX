import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { VaultsController } from './vaults.controller';
import { VaultsService } from './vaults.service';

@Module({
  imports: [AuthModule, FinancialCoreModule],
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}
