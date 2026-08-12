/**
 * CompanyController — إدارة الشركات
 *
 * الصلاحيات:
 *   GET (list/one) → جميع المستخدمين (مفلتر تلقائياً بـ companyIds)
 *   POST / PATCH   → MANAGE_COMPANIES (owner | super_admin)
 *   DELETE         → DELETE_COMPANY   (owner فقط)
 */
import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard }           from '@nestjs/passport';
import { CompanyAccessGuard }  from '../auth/guards/company-access.guard';
import { RolesGuard }          from '../auth/guards/roles.guard';
import { RequirePermission }   from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { SkipCompanyCheck }    from '../auth/decorators/skip-company-check.decorator';
import { CompanyService }      from './company.service';
import { createCompanySchema } from './dto/create-company.dto';
import { updateCompanySchema } from './dto/update-company.dto';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../auth/constants/permissions';

@Controller('companies')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @SkipCompanyCheck()
  @RequirePermission('MANAGE_COMPANIES')
  async create(@Body() body: unknown) {
    const dto = createCompanySchema.parse(body);
    return this.companyService.create(dto);
  }

  @Get()
  @SkipCompanyCheck()
  async findAll(
    @Query('includeArchived') includeArchived?: string,
    @Req() req?: { user?: { role?: string; companyIds?: string[] } },
  ) {
    const user      = req?.user;
    const allowedIds =
      user && !isSuperAdmin(user.role ?? '') ? user.companyIds || [] : undefined;
    return this.companyService.findAll(includeArchived === 'true', allowedIds);
  }

  @Get(':id')
  @SkipCompanyCheck()
  async findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @SkipCompanyCheck()
  @RequireAnyPermission('MANAGE_COMPANIES', 'MANAGE_TAX_SETTINGS', 'MANAGE_SETTINGS')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req?: { user?: { role?: string; permissions?: string[] } },
  ) {
    const dto = updateCompanySchema.parse(body);
    const role = req?.user?.role ?? '';
    const permissions = req?.user?.permissions ?? [];
    const hasTaxFields = dto.vatEnabledForSales !== undefined || dto.vatRatePercent !== undefined;
    const hasCompanyFields = Object.keys(dto).some(
      (key) => key !== 'vatEnabledForSales' && key !== 'vatRatePercent',
    );

    const canManageTax =
      hasPermission(role, PERMISSIONS.MANAGE_TAX_SETTINGS, permissions) ||
      hasPermission(role, PERMISSIONS.MANAGE_SETTINGS, permissions);
    if (hasTaxFields && !canManageTax) {
      throw new ForbiddenException('تحتاج صلاحية إدارة إعدادات الضريبة.');
    }
    if (hasCompanyFields && !hasPermission(role, PERMISSIONS.MANAGE_COMPANIES, permissions)) {
      throw new ForbiddenException('تحتاج صلاحية إدارة الشركات.');
    }

    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @SkipCompanyCheck()
  @RequirePermission('DELETE_COMPANY')
  async remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
