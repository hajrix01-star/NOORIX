/**
 * SalesController — ملخصات المبيعات اليومية
 *
 * الصلاحيات:
 *   POST /summary  → SALES_WRITE  (owner | super_admin | accountant | cashier)
 *   GET /summaries → SALES_READ   (owner | super_admin | accountant | cashier)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard }            from '@nestjs/passport';
import { CompanyAccessGuard }   from '../auth/guards/company-access.guard';
import { RolesGuard }           from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission }    from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { clampSalesSummaryDateQuery } from '../common/utils/sales-summary-date-range';
import { toYmd } from '../common/utils/to-ymd.util';
import { SalesService }           from './sales.service';
import { CreateSalesSummaryDto }  from './dto/create-sales-summary.dto';
import { CreateSalesSummaryBatchDto } from './dto/create-sales-summary-batch.dto';
import { UpdateSalesSummaryDto }  from './dto/update-sales-summary.dto';

@Controller('sales')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('summary')
  @RequirePermission('SALES_WRITE')
  async createSummary(
    @Body()        dto:  CreateSalesSummaryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.salesService.createSummary({
      companyId:       dto.companyId,
      transactionDate: dto.transactionDate,
      customerCount:   dto.customerCount  ?? 0,
      shift:           dto.shift,
      cashOnHand:      dto.cashOnHand     ?? '0',
      channels:        dto.channels       ?? [],
      notes:           dto.notes,
      idempotencyKey:  dto.idempotencyKey,
      userId:          user.sub,
    });
  }

  @Post('summary-batch')
  @RequirePermission('SALES_WRITE')
  async createSummaryBatch(
    @Body()        dto:  CreateSalesSummaryBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.salesService.createSummaryBatch({
      companyId:            dto.companyId,
      transactionDate:      dto.transactionDate,
      items:                dto.items.map((item) => ({
        shift:          item.shift,
        customerCount:  item.customerCount,
        cashOnHand:     item.cashOnHand ?? '0',
        channels:       item.channels ?? [],
        notes:          item.notes,
      })),
      batchIdempotencyKey: dto.batchIdempotencyKey,
      userId:              user.sub,
    });
  }

  @Patch('summaries/:id')
  @RequirePermission('SALES_WRITE')
  async updateSummary(
    @Param('id')   id:      string,
    @Body()        dto:     UpdateSalesSummaryDto,
    @CompanyId() companyId: string,
    @CurrentUser() user:   JwtUser,
  ) {
    if (!companyId) throw new Error('companyId مطلوب');
    return this.salesService.updateSummary(id, companyId, {
      transactionDate: dto.transactionDate,
      customerCount:   dto.customerCount,
      shift:           dto.shift,
      cashOnHand:      dto.cashOnHand,
      channels:        dto.channels,
      notes:           dto.notes,
    }, user.sub);
  }

  @Delete('summaries/:id')
  @Roles('owner')
  async cancelSummary(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!companyId) throw new Error('companyId مطلوب');
    return this.salesService.cancelSummary(id, companyId, user.sub);
  }

  /** حزمة واحدة للوحة التحكم — سنة + يومي + شهري في طلب واحد (بدل حلقات pagination). */
  @Get('summaries/dashboard-pack')
  @RequirePermission('SALES_READ')
  async dashboardSalesPack(
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Query('yearStart') yearStart: string,
    @Query('yearEnd') yearEnd: string,
    @Query('dailyStart') dailyStart?: string,
    @Query('dailyEnd') dailyEnd?: string,
    @Query('monthStart') monthStart?: string,
    @Query('monthEnd') monthEnd?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    if (!companyId) {
      return { yearSummaries: [], dailySummaries: [], monthSummaries: [] };
    }
    if (!hasPermission(user.role, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST, user.permissions)) {
      return { yearSummaries: [], dailySummaries: [], monthSummaries: [] };
    }

    const fullHist = hasPermission(user.role, PERMISSIONS.SALES_FULL_HISTORY, user.permissions);
    let ys = toYmd(yearStart ?? '');
    let ye = toYmd(yearEnd ?? '');
    let ds = dailyStart ? toYmd(dailyStart) : undefined;
    let de = dailyEnd ? toYmd(dailyEnd) : undefined;
    let ms = monthStart ? toYmd(monthStart) : undefined;
    let me = monthEnd ? toYmd(monthEnd) : undefined;

    if (!fullHist) {
      const cy = clampSalesSummaryDateQuery(ys, ye, 7);
      ys = cy.startDate;
      ye = cy.endDate;
      if (ds && de) {
        const cd = clampSalesSummaryDateQuery(ds, de, 7);
        ds = cd.startDate;
        de = cd.endDate;
      }
      if (ms && me) {
        const cm = clampSalesSummaryDateQuery(ms, me, 7);
        ms = cm.startDate;
        me = cm.endDate;
      }
    }

    return this.salesService.findDashboardPack(
      companyId,
      {
        yearStart: ys,
        yearEnd: ye,
        dailyStart: ds ?? null,
        dailyEnd: de ?? null,
        monthStart: ms ?? null,
        monthEnd: me ?? null,
      },
      includeCancelled === '1' || includeCancelled === 'true',
    );
  }

  @Get('summaries')
  @RequirePermission('SALES_READ')
  async findAll(
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
    @Query('page')      page?:      string,
    @Query('pageSize')  pageSize?:  string,
    @Query('q')         q?:         string,
    @Query('sortBy')    sortBy?:    string,
    @Query('sortDir')   sortDir?:   string,
    @Query('includeCancelled') includeCancelled?: string,
    @Query('shift') shift?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 30;
    if (!companyId) return { items: [], total: 0, page: 1, pageSize: 30 };

    if (!hasPermission(user.role, PERMISSIONS.SALES_VIEW_SUMMARIES_LIST, user.permissions)) {
      return { items: [], total: 0, page: pageNum, pageSize: Math.min(200, Math.max(1, pageSizeNum)) };
    }

    let effStart = startDate;
    let effEnd = endDate;
    if (!hasPermission(user.role, PERMISSIONS.SALES_FULL_HISTORY, user.permissions)) {
      const c = clampSalesSummaryDateQuery(startDate, endDate, 7);
      effStart = c.startDate;
      effEnd = c.endDate;
    }

    return this.salesService.findAll(
      companyId,
      effStart,
      effEnd,
      pageNum,
      pageSizeNum,
      q,
      sortBy,
      sortDir,
      includeCancelled === '1' || includeCancelled === 'true',
      shift,
    );
  }
}
