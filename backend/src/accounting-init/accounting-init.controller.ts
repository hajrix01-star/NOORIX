/**
 * AccountingInitController — endpoints إعادة تهيئة الفئات والحسابات
 *
 * محمي بـ JWT + super_admin فقط.
 * الغرض: ترحيل الشركات الحالية إلى هيكل الفئات الجديد (أكواد تحليلية P1-1، E3-2 ...).
 *
 * POST /accounting-init/reset-categories/:companyId   — شركة واحدة
 * POST /accounting-init/reset-all-categories          — جميع الشركات
 */
import {
  Controller, Post, Param, Req, ForbiddenException, UseGuards,
} from '@nestjs/common';
import { AuthGuard }            from '@nestjs/passport';
import { CompanyAccessGuard }   from '../auth/guards/company-access.guard';
import { RolesGuard }           from '../auth/guards/roles.guard';
import { SkipCompanyCheck }     from '../auth/decorators/skip-company-check.decorator';
import { AccountingInitService } from './accounting-init.service';
import { isSuperAdmin }         from '../auth/constants/permissions';
import { TenantContext }        from '../common/tenant-context';

@Controller('accounting-init')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class AccountingInitController {
  constructor(private readonly initService: AccountingInitService) {}

  /** إعادة تهيئة شركة واحدة بالكود التحليلي الجديد */
  @Post('reset-categories/:companyId')
  @SkipCompanyCheck()
  async resetOne(@Param('companyId') companyId: string, @Req() req: any) {
    if (!isSuperAdmin(req.user?.role ?? '')) {
      throw new ForbiddenException('هذا الإجراء للمسؤول العام فقط');
    }
    const tenantId = TenantContext.getTenantId();
    const result = await this.initService.resetAndReinitializeCategories(tenantId, companyId);
    return {
      success: true,
      message: `تم إعادة تهيئة الفئات للشركة ${companyId}`,
      data: result,
    };
  }

  /** إعادة تهيئة جميع الشركات دفعةً واحدة */
  @Post('reset-all-categories')
  @SkipCompanyCheck()
  async resetAll(@Req() req: any) {
    if (!isSuperAdmin(req.user?.role ?? '')) {
      throw new ForbiddenException('هذا الإجراء للمسؤول العام فقط');
    }
    const tenantId = TenantContext.getTenantId();
    const result = await this.initService.resetAllCompaniesCategories(tenantId);
    return {
      success: true,
      message: `تم إعادة تهيئة الفئات لـ ${result.companies} شركة`,
      data: result,
    };
  }

  /** إضافة الفئات الناقصة فقط لشركة واحدة — بدون حذف */
  @Post('patch-categories/:companyId')
  @SkipCompanyCheck()
  async patchOne(@Param('companyId') companyId: string, @Req() req: any) {
    if (!isSuperAdmin(req.user?.role ?? '')) {
      throw new ForbiddenException('هذا الإجراء للمسؤول العام فقط');
    }
    const tenantId = TenantContext.getTenantId();
    const result = await this.initService.patchMissingSubcategories(tenantId, companyId);
    return {
      success: true,
      message: `تمت إضافة ${result.added} فئة جديدة (${result.skipped} موجودة مسبقاً)`,
      data: result,
    };
  }

  /** إضافة الفئات الناقصة لجميع الشركات — بدون حذف */
  @Post('patch-all-categories')
  @SkipCompanyCheck()
  async patchAll(@Req() req: any) {
    if (!isSuperAdmin(req.user?.role ?? '')) {
      throw new ForbiddenException('هذا الإجراء للمسؤول العام فقط');
    }
    const tenantId = TenantContext.getTenantId();
    const result = await this.initService.patchAllCompaniesSubcategories(tenantId);
    return {
      success: true,
      message: `تمت إضافة ${result.totalAdded} فئة لـ ${result.companies} شركة`,
      data: result,
    };
  }
}
