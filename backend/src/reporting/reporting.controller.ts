import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuditLogService } from '../audit/audit-log.service';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CompanyInsightThresholdSettingsService } from './insights/company-insight-threshold-settings.service';
import { DashboardInsightsService } from './insights/dashboard-insights.service';
import { GetDashboardInsightsQueryDto } from './dto/dashboard-insights-query.dto';
import { GetInsightThresholdsQueryDto } from './dto/get-insight-thresholds-query.dto';
import { PatchInsightThresholdsDto } from './dto/patch-insight-thresholds.dto';
import { ResetInsightThresholdsDto } from './dto/reset-insight-thresholds.dto';

type JwtUser = { userId?: string; sub?: string };
type ReportingInsightsReader = Pick<DashboardInsightsService, 'buildDashboardInsights'>;
type ReportingThresholdSettings = Pick<
  CompanyInsightThresholdSettingsService,
  'getResolvedThresholds' | 'updateStoredThresholds' | 'resetStoredThresholds'
>;
type ReportingAuditLog = Pick<AuditLogService, 'log' | 'logUpdate'>;

/**
 * Read-only reporting endpoints. Insights delegate to {@link DashboardInsightsService} without transforming payloads.
 */
@Controller('reporting/insights')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ReportingController {
  constructor(
    private readonly dashboardInsightsService: ReportingInsightsReader,
    private readonly companyInsightThresholdSettings: ReportingThresholdSettings,
    private readonly auditLog: ReportingAuditLog,
  ) {}

  /** GET /api/v1/reporting/insights/thresholds */
  @Get('thresholds')
  @RequireAnyPermission('REPORTS_READ', 'MANAGE_COMPANIES')
  async getInsightThresholds(@Query() query: GetInsightThresholdsQueryDto) {
    const thresholds = await this.companyInsightThresholdSettings.getResolvedThresholds(query.companyId);
    return { companyId: query.companyId, thresholds };
  }

  /** PATCH /api/v1/reporting/insights/thresholds */
  @Patch('thresholds')
  @RequirePermission('MANAGE_COMPANIES')
  async patchInsightThresholds(@Body() body: PatchInsightThresholdsDto, @Req() req: Request & { user?: JwtUser }) {
    const oldResolved = await this.companyInsightThresholdSettings.getResolvedThresholds(body.companyId);
    const thresholds = await this.companyInsightThresholdSettings.updateStoredThresholds(body.companyId, {
      purchaseToSales: body.purchaseToSales,
      expenseToSales: body.expenseToSales,
      netProfitMargin: body.netProfitMargin,
    });
    const uid = req.user?.userId ?? req.user?.sub ?? null;
    await this.auditLog.logUpdate(
      body.companyId,
      'company_insight_settings',
      body.companyId,
      { thresholds: oldResolved },
      { thresholds },
      uid,
    );
    return { companyId: body.companyId, thresholds };
  }

  /** POST /api/v1/reporting/insights/thresholds/reset */
  @Post('thresholds/reset')
  @RequirePermission('MANAGE_COMPANIES')
  async resetInsightThresholds(@Body() body: ResetInsightThresholdsDto, @Req() req: Request & { user?: JwtUser }) {
    const oldResolved = await this.companyInsightThresholdSettings.getResolvedThresholds(body.companyId);
    const thresholds = await this.companyInsightThresholdSettings.resetStoredThresholds(body.companyId);
    const uid = req.user?.userId ?? req.user?.sub ?? null;
    await this.auditLog.log({
      companyId: body.companyId,
      userId: uid,
      action: 'reset',
      entity: 'company_insight_settings',
      entityId: body.companyId,
      oldValue: { thresholds: oldResolved },
      newValue: { thresholds },
    });
    return { companyId: body.companyId, thresholds };
  }

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
