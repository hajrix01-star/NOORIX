import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

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
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermission('REPORTS_READ')
  async getOverview(
    @Query() query: DashboardOverviewQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.getOverview(query, user);
  }

  // ── Calendar Data ─────────────────────────────────────

  @Get('calendar')
  @RequirePermission('REPORTS_READ')
  async getCalendarData(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.getCalendarData(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @Put('calendar/targets')
  @RequirePermission('REPORTS_READ')
  async putCalendarTargets(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: { targets: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.upsertCalendarTargets(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.targets,
    );
  }

  @Put('calendar/special-days')
  @RequirePermission('REPORTS_READ')
  async putCalendarSpecialDays(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: { specialDays: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.upsertCalendarSpecialDays(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.specialDays,
    );
  }

  @Put('calendar/day-notes')
  @RequirePermission('REPORTS_READ')
  async putCalendarDayNotes(
    @Query('companyId') companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Body() body: { dayNotes: unknown },
    @CurrentUser() user: JwtUser,
  ) {
    return this.dashboardService.upsertCalendarDayNotes(
      companyId,
      user.tenantId ?? '',
      parseInt(year, 10),
      parseInt(month, 10),
      body.dayNotes,
    );
  }
}
