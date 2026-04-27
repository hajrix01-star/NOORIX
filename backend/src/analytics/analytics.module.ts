import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { ReportsModule } from '../reports/reports.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsStudioQueryService } from './analytics-studio-query.service';

@Module({
  imports: [AuthModule, CompanyModule, ReportsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsStudioQueryService],
})
export class AnalyticsModule {}
