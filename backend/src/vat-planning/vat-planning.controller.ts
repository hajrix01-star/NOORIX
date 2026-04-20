import { Body, Controller, Delete, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { VatPlanningService, UpsertVatPlanningDto } from './vat-planning.service';
import type { JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('vat-planning')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class VatPlanningController {
  constructor(private readonly service: VatPlanningService) {}

  @Get()
  @SkipCompanyCheck()
  @RequirePermission('REPORTS_READ')
  async list(
    @Query('year') yearStr: string,
    @Query('quarter') quarterStr: string,
    @Query('companyId') companyId: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(quarterStr, 10);
    return this.service.list(req.user, year, quarter, companyId);
  }

  @Put()
  @SkipCompanyCheck()
  @RequirePermission('REPORTS_READ')
  async upsert(@Req() req: { user: JwtUser }, @Body() body: UpsertVatPlanningDto) {
    return this.service.upsert(req.user, body);
  }

  @Delete()
  @SkipCompanyCheck()
  @RequirePermission('REPORTS_READ')
  async remove(
    @Query('companyId') companyId: string,
    @Query('year') yearStr: string,
    @Query('quarter') quarterStr: string,
    @Req() req: { user: JwtUser },
  ) {
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(quarterStr, 10);
    return this.service.remove(req.user, companyId, year, quarter);
  }
}
