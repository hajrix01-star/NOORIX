import { Module } from '@nestjs/common';
import { FiscalPeriodService } from './fiscal-period.service';
import { FiscalPeriodController } from './fiscal-period.controller';

@Module({
  controllers: [FiscalPeriodController],
  providers: [FiscalPeriodService],
  exports: [FiscalPeriodService],
})
export class FiscalPeriodModule {}
