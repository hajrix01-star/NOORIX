import { Module } from '@nestjs/common';
import { AccountingInitService }    from './accounting-init.service';
import { AccountingInitController } from './accounting-init.controller';

@Module({
  controllers: [AccountingInitController],
  providers:   [AccountingInitService],
  exports:     [AccountingInitService],
})
export class AccountingInitModule {}
