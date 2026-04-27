import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsPeriodAnalyticsService } from './reports-period-analytics.service';
import { ReportsTaxVatService } from './reports-tax-vat.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsPeriodAnalyticsService, ReportsTaxVatService],
  exports: [ReportsService],
})
export class ReportsModule {}
