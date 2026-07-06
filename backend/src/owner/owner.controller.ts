import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { OwnerService } from './owner.service';
import { OwnerOverviewQueryDto } from './dto/owner-overview-query.dto';

type OwnerOverviewReader = Pick<OwnerService, 'getOverview'>;

/**
 * GET /api/v1/owner/overview
 *
 * Endpoint موحّد للمالك: يُنفّذ P&L + مبيعات يومية لكل الشركات بـ Promise.all()
 * ويُعيد نتيجة واحدة — يحلّ مشكلة "تغيّر الأرقام" الناتجة عن N×2 طلبات منفصلة.
 *
 * @SkipCompanyCheck — لأن الـ endpoint يخدم عدة شركات ليس شركة واحدة؛
 * التحقق من الصلاحية يتم في OwnerService.resolveAccessibleIds().
 */
@Controller('owner')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OwnerController {
  constructor(@Inject(OwnerService) private readonly ownerService: OwnerOverviewReader) {}

  @Get('overview')
  @SkipCompanyCheck()
  @RequirePermission('VIEW_OWNER')
  async getOverview(
    @Query() query: OwnerOverviewQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.ownerService.getOverview(query, user);
  }
}
