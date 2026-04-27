import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsStudioQueryDto } from './dto/analytics-studio-query.dto';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('studio')
  @SkipCompanyCheck()
  @RequirePermission('REPORTS_READ')
  async getStudio(@Query() query: AnalyticsStudioQueryDto, @Req() req: { user: { role?: string; companyIds?: string[] } }) {
    return this.analyticsService.getStudio(req.user, query);
  }
}
