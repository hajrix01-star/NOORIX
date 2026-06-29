import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsPeriodAnalyticsService } from './reports-period-analytics.service';
import { ReportsTaxVatService } from './reports-tax-vat.service';
import { TaxVatCoreModule } from '../tax-vat-core/tax-vat-core.module';

@Module({
  imports: [PrismaModule, AuthModule, TaxVatCoreModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPeriodAnalyticsService, ReportsTaxVatService],
  exports: [ReportsService],
})
export class ReportsModule {}
