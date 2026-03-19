import { Module } from '@nestjs/common';
import { AccountingInitService } from './accounting-init.service';

@Module({
  providers: [AccountingInitService],
  exports: [AccountingInitService],
})
export class AccountingInitModule {}
