/**
 * FiscalPeriodController — إدارة الفترات المالية
 */
import { Controller, Get, Post, Body, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { FiscalPeriodService } from './fiscal-period.service';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { TenantContext } from '../common/tenant-context';

@Controller('fiscal-periods')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class FiscalPeriodController {
  constructor(private readonly service: FiscalPeriodService) {}

  /** قراءة — محاسب وما فوق يمكنهم الاطلاع على الفترات */
  @Get('company/:companyId')
  @RequirePermission('REPORTS_READ')
  async findAll(@Param('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Post()
  @RequirePermission('MANAGE_SETTINGS')
  async create(@Body() body: { companyId: string; nameAr: string; nameEn?: string; startDate: string; endDate: string }) {
    const tenantId = TenantContext.getTenantId();
    return this.service.createPeriod(tenantId, body.companyId, {
      nameAr: body.nameAr,
      nameEn: body.nameEn,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
    });
  }

  @Post(':id/close')
  @RequirePermission('MANAGE_SETTINGS')
  async close(
    @Param('id') id: string,
    @Body() body: { companyId: string },
    @CurrentUser() user: JwtUser,
  ) {
    const userId = user.sub ?? user.userId;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.service.closePeriod(id, body.companyId, userId);
  }

  @Post(':id/reopen')
  @RequirePermission('MANAGE_SETTINGS')
  async reopen(
    @Param('id') id: string,
    @Body() body: { companyId: string },
  ) {
    return this.service.reopenPeriod(id, body.companyId);
  }
}
