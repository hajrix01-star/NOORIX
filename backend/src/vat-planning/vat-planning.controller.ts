import { Body, Controller, Delete, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { VatPlanningService, UpsertVatPlanningDto } from './vat-planning.service';
import type { JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('vat-planning')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class VatPlanningController {
  constructor(private readonly service: VatPlanningService) {}

  /** سجل الإقرارات المحفوظة مع فلاتر اختيارية */
  @Get('registry')
  @SkipCompanyCheck()
  @RequireAnyPermission('HAJRI_TAX_READ', 'REPORTS_READ')
  async listRegistry(
    @Query('year') yearStr: string | undefined,
    @Query('quarter') quarterStr: string | undefined,
    /** فلتر اختياري فقط من السلسلة — لا نستخدم x-company-id حتى يظهر السجل لجميع الشركات المسموح بها */
    @Query('companyId') companyIdFilter: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    const yearParsed = yearStr !== undefined && yearStr !== '' ? parseInt(yearStr, 10) : NaN;
    const quarterParsed = quarterStr !== undefined && quarterStr !== '' ? parseInt(quarterStr, 10) : NaN;
    const year = Number.isFinite(yearParsed) ? yearParsed : undefined;
    const quarter =
      Number.isFinite(quarterParsed) && quarterParsed >= 1 && quarterParsed <= 4
        ? quarterParsed
        : undefined;
    const companyId = companyIdFilter?.trim() || undefined;
    return this.service.listRegistry(req.user, { year, quarter, companyId });
  }

  @Get()
  @SkipCompanyCheck()
  @RequireAnyPermission('HAJRI_TAX_READ', 'REPORTS_READ')
  async list(
    @Query('year') yearStr: string,
    @Query('quarter') quarterStr: string,
    /** فلتر اختياري من السلسلة فقط — بدونها تُعرض كل الشركات المسموح بها للربع */
    @Query('companyId') companyIdFilter: string | undefined,
    @Req() req: { user: JwtUser },
  ) {
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(quarterStr, 10);
    const companyId = companyIdFilter?.trim() || undefined;
    return this.service.list(req.user, year, quarter, companyId);
  }

  @Put()
  @SkipCompanyCheck()
  @RequireAnyPermission('HAJRI_TAX_WRITE')
  async upsert(@Req() req: { user: JwtUser }, @Body() body: UpsertVatPlanningDto) {
    return this.service.upsert(req.user, body);
  }

  @Delete()
  @SkipCompanyCheck()
  @RequireAnyPermission('HAJRI_TAX_WRITE')
  async remove(
    @CompanyId() companyId: string,
    @Query('year') yearStr: string,
    @Query('quarter') quarterStr: string,
    @Req() req: { user: JwtUser },
  ) {
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(quarterStr, 10);
    return this.service.remove(req.user, companyId, year, quarter);
  }
}
