import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { DashboardInsightsService } from './insights/dashboard-insights.service';
import { GetDashboardInsightsQueryDto } from './dto/dashboard-insights-query.dto';

/**
 * Read-only reporting endpoints. Insights delegate to {@link DashboardInsightsService} without transforming payloads.
 */
@Controller('reporting/insights')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ReportingController {
  constructor(private readonly dashboardInsightsService: DashboardInsightsService) {}

  /** GET /api/v1/reporting/insights/dashboard */
  @Get('dashboard')
  @RequirePermission('REPORTS_READ')
  async getDashboardInsights(@Query() query: GetDashboardInsightsQueryDto) {
    return this.dashboardInsightsService.buildDashboardInsights(query.companyId, {
      year: query.year,
      yearStart: query.yearStart,
      yearEnd: query.yearEnd,
      dailyStart: query.dailyStart ?? null,
      dailyEnd: query.dailyEnd ?? null,
      monthStart: query.monthStart ?? null,
      monthEnd: query.monthEnd ?? null,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      includeCancelledSales: query.includeCancelledSales === true,
    }, query.selectedMonth ?? null);
  }
}
