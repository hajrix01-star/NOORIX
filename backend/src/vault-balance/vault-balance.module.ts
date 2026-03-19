import { Module } from '@nestjs/common';
import { VaultBalanceService } from './vault-balance.service';

@Module({
  providers: [VaultBalanceService],
  exports: [VaultBalanceService],
})
export class VaultBalanceModule {}
