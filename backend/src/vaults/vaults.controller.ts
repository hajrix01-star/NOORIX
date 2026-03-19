/**
 * VaultsController — إدارة الخزائن
 *
 * الصلاحيات:
 *   GET         → VAULTS_READ   (الكل)
 *   POST        → VAULTS_WRITE  (owner | super_admin | accountant)
 *   PATCH/:id   → VAULTS_WRITE  (owner | super_admin | accountant)
 *   PATCH/archive → VAULTS_WRITE
 *   DELETE/:id  → VAULTS_DELETE (owner | super_admin فقط) — ناعم: يُغلق لا يحذف
 */
import {
  BadRequestException, Body, Controller,
  Delete, Get, Headers, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard }             from '@nestjs/passport';
import { ZodError }              from 'zod';
import { CompanyAccessGuard }    from '../auth/guards/company-access.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser }  from '../auth/decorators/current-user.decorator';
import { RequirePermission }     from '../auth/decorators/require-permission.decorator';
import { createVaultSchema, updateVaultSchema } from './dto/create-vault.dto';
import { VaultsService }         from './vaults.service';

@Controller('vaults')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class VaultsController {
  constructor(private readonly vaultsService: VaultsService) {}

  // ── مساعد: استخراج companyId ────────────────────────────
  private resolveCompanyId(header?: string, query?: string): string {
    return (header?.trim() || query?.trim()) || '';
  }

  @Get()
  @RequirePermission('VAULTS_READ')
  async findAll(
    @Query('companyId')      queryCompanyId:  string,
    @Headers('x-company-id') headerCompanyId: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('startDate')      startDate?:      string,
    @Query('endDate')        endDate?:        string,
  ) {
    const companyId = this.resolveCompanyId(headerCompanyId, queryCompanyId);
    if (!companyId) return [];
    return this.vaultsService.findAll(
      companyId,
      includeArchived === 'true',
      startDate,
      endDate,
    );
  }

  @Get(':id/transactions')
  @RequirePermission('VAULTS_READ')
  async findTransactions(
    @Param('id')             id:               string,
    @Query('companyId')      queryCompanyId:   string,
    @Headers('x-company-id') headerCompanyId:  string,
    @Query('startDate')      startDate?:        string,
    @Query('endDate')        endDate?:          string,
    @Query('page')           page?:             string,
    @Query('pageSize')       pageSize?:         string,
  ) {
    const companyId = this.resolveCompanyId(headerCompanyId, queryCompanyId);
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required for vault transactions');
    }
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const size = Math.min(10000, Math.max(1, parseInt(pageSize ?? '50', 10) || 50));
    const s = startDate as string;
    const e = endDate as string;
    return this.vaultsService.findOneWithTransactions(id, companyId, s, e, pageNum, size);
  }

  @Post()
  @RequirePermission('VAULTS_WRITE')
  async create(
    @Body()        body: unknown,
    @CurrentUser() user: JwtUser,
  ) {
    try {
      const dto = createVaultSchema.parse(body);
      return this.vaultsService.create(dto, user.sub);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات غير صحيحة');
      }
      throw e;
    }
  }

  @Patch(':id')
  @RequirePermission('VAULTS_WRITE')
  async update(
    @Param('id')             id:               string,
    @Query('companyId')      queryCompanyId:   string,
    @Headers('x-company-id') headerCompanyId:  string,
    @Body()                  body:             unknown,
    @CurrentUser()           user:             JwtUser,
  ) {
    const companyId = this.resolveCompanyId(headerCompanyId, queryCompanyId);
    try {
      const dto = updateVaultSchema.parse(body);
      return this.vaultsService.update(id, companyId, dto, user.sub);
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException(e.errors?.[0]?.message ?? 'بيانات غير صحيحة');
      }
      throw e;
    }
  }

  @Patch(':id/archive')
  @RequirePermission('VAULTS_WRITE')
  async archive(
    @Param('id')             id:               string,
    @Query('companyId')      queryCompanyId:   string,
    @Headers('x-company-id') headerCompanyId:  string,
    @CurrentUser()           user:             JwtUser,
  ) {
    const companyId = this.resolveCompanyId(headerCompanyId, queryCompanyId);
    return this.vaultsService.archive(id, companyId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('VAULTS_DELETE')
  async remove(
    @Param('id')             id:               string,
    @Query('companyId')      queryCompanyId:   string,
    @Headers('x-company-id') headerCompanyId:  string,
    @CurrentUser()           user:             JwtUser,
  ) {
    const companyId = this.resolveCompanyId(headerCompanyId, queryCompanyId);
    // ناعم فقط — VaultsService.remove يتحقق من غياب القيود ويُغلق الخزنة
    return this.vaultsService.remove(id, companyId, user.sub);
  }
}
