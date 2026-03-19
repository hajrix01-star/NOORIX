/**
 * CompanyController — إدارة الشركات
 *
 * الصلاحيات:
 *   GET (list/one) → جميع المستخدمين (مفلتر تلقائياً بـ companyIds)
 *   POST / PATCH   → MANAGE_COMPANIES (owner | super_admin)
 *   DELETE         → DELETE_COMPANY   (owner فقط)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard }           from '@nestjs/passport';
import { CompanyAccessGuard }  from '../auth/guards/company-access.guard';
import { RolesGuard }          from '../auth/guards/roles.guard';
import { RequirePermission }   from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck }    from '../auth/decorators/skip-company-check.decorator';
import { CompanyService }      from './company.service';
import { createCompanySchema } from './dto/create-company.dto';
import { updateCompanySchema } from './dto/update-company.dto';
import { isSuperAdmin }        from '../auth/constants/permissions';

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
  @RequirePermission('MANAGE_COMPANIES')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateCompanySchema.parse(body);
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @SkipCompanyCheck()
  @RequirePermission('DELETE_COMPANY')
  async remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
