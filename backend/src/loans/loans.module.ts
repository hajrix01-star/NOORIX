import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { FiscalPeriodModule } from '../fiscal-period/fiscal-period.module';
@Module({ imports: [FiscalPeriodModule], controllers: [LoansController], providers: [LoansService] })
export class LoansModule {}
