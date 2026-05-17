import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

/**
 * GET /api/v1/dashboard/overview
 *
 * Endpoint موحّد للوحة التحكم: يُنفّذ 4 استعلامات بالتوازي (P&L + Sales Pack + Insights + Period Analytics)
 * ويُعيد نتيجة واحدة — يحلّ مشكلة "تغيّر الأرقام" الناتجة عن اكتمال الطلبات بترتيب مختلف.
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
}
