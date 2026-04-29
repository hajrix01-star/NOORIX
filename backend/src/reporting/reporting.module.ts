import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { SalesModule } from '../sales/sales.module';
import { CompanyInsightThresholdSettingsService } from './insights/company-insight-threshold-settings.service';
import { DashboardInsightsService } from './insights/dashboard-insights.service';
import { ExpenseInsightsService } from './insights/expenses/expense-insights.service';
import { PurchaseSupplierInsightsService } from './insights/purchases/purchase-supplier-insights.service';
import { ReportingFacade } from './reporting.facade';
import { ReportingController } from './reporting.controller';

/**
 * Registers {@link ReportingFacade}, {@link DashboardInsightsService}, and read-only reporting HTTP routes.
 */
@Module({
  imports: [AuthModule, ReportsModule, SalesModule],
  controllers: [ReportingController],
  providers: [
    ReportingFacade,
    CompanyInsightThresholdSettingsService,
    DashboardInsightsService,
    PurchaseSupplierInsightsService,
    ExpenseInsightsService,
  ],
  exports: [
    ReportingFacade,
    DashboardInsightsService,
    PurchaseSupplierInsightsService,
    ExpenseInsightsService,
  ],
})
export class ReportingModule {}
