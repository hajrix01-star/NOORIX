import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { DashboardInsightsService } from './insights/dashboard-insights.service';
import { ReportingFacade } from './reporting.facade';
import { ReportingController } from './reporting.controller';

/**
 * Registers {@link ReportingFacade}, {@link DashboardInsightsService}, and read-only reporting HTTP routes.
 */
@Module({
  imports: [AuthModule, ReportsModule, SalesModule],
  controllers: [ReportingController],
  providers: [ReportingFacade, DashboardInsightsService],
  exports: [ReportingFacade, DashboardInsightsService],
})
export class ReportingModule {}
