/**
 * FiscalPeriodController — إدارة الفترات المالية
 */
import { Controller, Get, Post, Body, Param, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { FiscalPeriodService } from './fiscal-period.service';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { TenantContext } from '../common/tenant-context';

@Controller('api/v1/fiscal-periods')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard)
export class FiscalPeriodController {
  constructor(private readonly service: FiscalPeriodService) {}

  @Get('company/:companyId')
  async findAll(@Param('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Post()
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
  async reopen(
    @Param('id') id: string,
    @Body() body: { companyId: string },
  ) {
    return this.service.reopenPeriod(id, body.companyId);
  }
}
