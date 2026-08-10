import { Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { DashboardCalendarService } from './dashboard-calendar.service';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardLedgerReconciliationQueryDto } from './dto/dashboard-ledger-reconciliation-query.dto';
import { ApplySpecialOccasionsDto } from './dto/apply-special-occasions.dto';
import { ApplySchoolHolidaysDto } from './dto/apply-school-holidays.dto';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { DashboardLedgerProjectionService } from './dashboard-ledger-projection.service';

/**
 * GET  /api/v1/dashboard/overview
 * GET  /api/v1/dashboard/calendar
 * PUT  /api/v1/dashboard/calendar/targets
 * PUT  /api/v1/dashboard/calendar/special-days
 * PUT  /api/v1/dashboard/calendar/day-notes
 */
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly dashboardCalendarService: DashboardCalendarService,
    private readonly dashboardLedgerProjectionService: DashboardLedgerProjectionService,
  ) {}

  @Get('overview')
  @RequirePermission('REPORTS_READ')
  async getOverview(
    @Query() query: DashboardOverviewQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.getOverview(query, user);
  }

  @Get('ledger-reconciliation')
  @RequirePermission('VIEW_OWNER')
  async getLedgerReconciliation(@Query() query: DashboardLedgerReconciliationQueryDto) {
    return this.dashboardLedgerProjectionService.getPeriodReconciliation(
      query.companyId,
      query.startDate,
      query.endDate,
    );
  }

  // ── Calendar Data ─────────────────────────────────────

  @Get('calendar')
  @RequireAnyPermission('VIEW_DASHBOARD', 'REPORTS_READ')
  async getCalendarData(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardCalendarService.getCalendarData(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @Put('calendar/targets')
  @RequirePermission('VIEW_DASHBOARD')
  async putCalendarTargets(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('applyToAll') applyToAll: string,
    @Body() body: { targets: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardCalendarService.upsertCalendarTargets(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.targets,
      applyToAll !== 'false',
    );
  }

  @Delete('calendar/targets')
  @RequirePermission('VIEW_DASHBOARD')
  async resetCalendarTargets(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardCalendarService.resetMonthTargets(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @Get('calendar/saudi-occasions')
  @RequireAnyPermission('VIEW_DASHBOARD', 'REPORTS_READ')
  @SkipCompanyCheck()
  getSaudiOccasions(@Query('year') year: string) {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y)) {
      return [];
    }
    return this.dashboardCalendarService.getSaudiOccasions(y);
  }

  @Get('calendar/school-holidays')
  @RequireAnyPermission('VIEW_DASHBOARD', 'REPORTS_READ')
  @SkipCompanyCheck()
  getSchoolAcademicHolidays(@Query('year') year: string, @Query('variant') variant?: 'general' | 'western') {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y)) {
      return { source: null, variant: variant === 'western' ? 'western' : 'general', events: [] };
    }
    return this.dashboardCalendarService.getSchoolAcademicHolidays(y, variant);
  }

  @Get('calendar/occasion-catalog')
  @RequireAnyPermission('VIEW_DASHBOARD', 'REPORTS_READ')
  @SkipCompanyCheck()
  getCalendarOccasionCatalog(@Query('year') year: string, @Query('variant') variant?: 'general' | 'western') {
    const y = parseInt(year, 10);
    if (!Number.isFinite(y)) {
      return this.dashboardCalendarService.getCalendarOccasionCatalog(new Date().getFullYear(), variant);
    }
    return this.dashboardCalendarService.getCalendarOccasionCatalog(y, variant);
  }

  @Post('calendar/special-days/apply-occasions')
  @RequirePermission('VIEW_DASHBOARD')
  async applySaudiOccasions(
    @Query('companyId') companyId: string,
    @Body() body: ApplySpecialOccasionsDto,
    @CurrentUser() user: JwtUser,
  ) {
    const lang = body.lang === 'en' ? 'en' : 'ar';
    return this.dashboardCalendarService.applySaudiSpecialOccasions(
      user,
      user.tenantId ?? '',
      companyId,
      body.year,
      body.occasionIds,
      body.scope,
      lang,
      body.companyIds,
      body.dayShifts,
    );
  }

  @Post('calendar/special-days/apply-school-holidays')
  @RequirePermission('VIEW_DASHBOARD')
  async applySchoolAcademicHolidays(
    @Query('companyId') companyId: string,
    @Body() body: ApplySchoolHolidaysDto,
    @CurrentUser() user: JwtUser,
  ) {
    const lang = body.lang === 'en' ? 'en' : 'ar';
    return this.dashboardCalendarService.applySchoolAcademicHolidays(
      user,
      user.tenantId ?? '',
      companyId,
      body.year,
      body.eventIds,
      body.scope,
      lang,
      body.companyIds,
      body.variant,
    );
  }

  @Put('calendar/special-days')
  @RequirePermission('VIEW_DASHBOARD')
  async putCalendarSpecialDays(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: { specialDays: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardCalendarService.upsertCalendarSpecialDays(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.specialDays,
    );
  }

  @Put('calendar/day-notes')
  @RequirePermission('VIEW_DASHBOARD')
  async putCalendarDayNotes(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: { dayNotes: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardCalendarService.upsertCalendarDayNotes(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.dayNotes,
    );
  }
}
