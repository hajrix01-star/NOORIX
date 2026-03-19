/**
 * SalesController — ملخصات المبيعات اليومية
 *
 * الصلاحيات:
 *   POST /summary  → SALES_WRITE  (owner | super_admin | accountant | cashier)
 *   GET /summaries → SALES_READ   (owner | super_admin | accountant | cashier)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }            from '@nestjs/passport';
import { CompanyAccessGuard }   from '../auth/guards/company-access.guard';
import { RolesGuard }           from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission }    from '../auth/decorators/require-permission.decorator';
import { SalesService }           from './sales.service';
import { CreateSalesSummaryDto }  from './dto/create-sales-summary.dto';
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
      cashOnHand:      dto.cashOnHand     ?? '0',
      channels:        dto.channels       ?? [],
      notes:           dto.notes,
      idempotencyKey:  dto.idempotencyKey,
      userId:          user.sub,
    });
  }

  @Patch('summaries/:id')
  @RequirePermission('SALES_WRITE')
  async updateSummary(
    @Param('id')   id:      string,
    @Body()        dto:     UpdateSalesSummaryDto,
    @Query('companyId') companyId: string,
    @CurrentUser() user:   JwtUser,
  ) {
    if (!companyId) throw new Error('companyId مطلوب');
    return this.salesService.updateSummary(id, companyId, {
      transactionDate: dto.transactionDate,
      customerCount:   dto.customerCount,
      cashOnHand:      dto.cashOnHand,
      channels:        dto.channels,
      notes:           dto.notes,
    }, user.sub);
  }

  @Delete('summaries/:id')
  @RequirePermission('SALES_WRITE')
  async cancelSummary(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!companyId) throw new Error('companyId مطلوب');
    return this.salesService.cancelSummary(id, companyId, user.sub);
  }

  @Get('summaries')
  @RequirePermission('SALES_READ')
  async findAll(
    @Query('companyId') companyId:  string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
    @Query('page')      page?:      string,
    @Query('pageSize')  pageSize?:  string,
    @Query('q')         q?:         string,
    @Query('sortBy')    sortBy?:    string,
    @Query('sortDir')   sortDir?:   string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    if (!companyId) return { items: [], total: 0, page: 1, pageSize: 30 };
    return this.salesService.findAll(
      companyId,
      startDate,
      endDate,
      page     ? parseInt(page, 10)     : 1,
      pageSize ? parseInt(pageSize, 10) : 30,
      q,
      sortBy,
      sortDir,
      includeCancelled === '1' || includeCancelled === 'true',
    );
  }
}
