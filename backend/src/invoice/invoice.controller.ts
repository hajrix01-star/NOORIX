/**
 * InvoiceController — فواتير المبيعات والمشتريات والمصروفات
 *
 * الصلاحيات:
 *   POST → INVOICES_WRITE أو PURCHASES_WRITE
 *   PATCH (تعديل فاتورة) → المالك فقط
 *   GET → INVOICES_READ أو PURCHASES_READ
 *         (الفلترة بالـ kind تتم تلقائياً حسب ما يملكه المستخدم)
 */
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }             from '@nestjs/passport';
import { CompanyAccessGuard }    from '../auth/guards/company-access.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser }  from '../auth/decorators/current-user.decorator';
import { RequirePermission }     from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission }  from '../auth/decorators/require-any-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { hasPermission } from '../auth/constants/permissions';
import { CreateInvoiceDto }      from './dto/create-invoice.dto';
import { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { UpdateInvoiceDto }      from './dto/update-invoice.dto';
import { InvoiceService }        from './invoice.service';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @RequireAnyPermission('INVOICES_WRITE', 'PURCHASES_WRITE')
  async create(
    @Body()        dto:  CreateInvoiceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.createWithLedger(dto, user.sub);
  }

  @Post('batch')
  @RequireAnyPermission('INVOICES_WRITE', 'PURCHASES_WRITE')
  async createBatch(
    @Body()        dto:  CreateInvoiceBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.createBatchWithLedger(dto, user.sub);
  }

  @Get('purchase-batch-summaries')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async purchaseBatchSummaries(
    @Query('companyId') companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
    @Query('q')         q?:         string,
    @Query('lang')      lang?:      string,
  ) {
    if (!companyId) return { batches: [], rowCount: 0 };
    return this.invoiceService.findPurchaseBatchSummaries(companyId, startDate, endDate, q, lang);
  }

  @Get('day-close-report')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async dayCloseReport(
    @Query('companyId') companyId: string,
    @Query('date')     date:      string,
  ) {
    if (!companyId?.trim()) throw new BadRequestException('companyId مطلوب');
    return this.invoiceService.getDayCloseReport(companyId, date);
  }

  /** مستخدمو النظام الظاهرون كمنشئين لفواتير الشركة — لفلتر القائمة */
  @Get('creator-filter-options')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async creatorFilterOptions(@Query('companyId') companyId: string) {
    return this.invoiceService.getCreatorFilterOptions(companyId);
  }

  @Get()
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async findAll(
    @CurrentUser()        user:        JwtUser,
    @Query('companyId')   companyId:   string,
    @Query('page')        page?:       string,
    @Query('pageSize')    pageSize?:   string,
    @Query('startDate')   startDate?:  string,
    @Query('endDate')     endDate?:    string,
    @Query('batchId')     batchId?:    string,
    @Query('employeeId')  employeeId?: string,
    @Query('kind')        kind?:       string,
    @Query('supplierId')  supplierId?: string,
    @Query('categoryId')  categoryId?: string,
    @Query('expenseLineId') expenseLineId?: string,
    @Query('vaultId')      vaultId?:    string,
    @Query('sortBy')      sortBy?:     string,
    @Query('sortDir')     sortDir?:    string,
    @Query('q')           q?:          string,
    @Query('includeCancelled') includeCancelled?: string,
    @Query('hasNotes')   hasNotes?:   string,
    @Query('createdByUserId') createdByUserId?: string,
  ) {
    const role  = (user?.role  || '').toLowerCase();
    const perms = user?.permissions || [];

    const canSales     = hasPermission(role, 'INVOICES_READ',  perms);
    const canPurchases = hasPermission(role, 'PURCHASES_READ', perms);

    // فلترة تلقائية حسب الصلاحية إذا لم يكن المستخدم يملك كلاً منهما
    let resolvedKind = kind;
    if (!canSales && canPurchases && !kind) {
      resolvedKind = 'purchase';
    } else if (canSales && !canPurchases && !kind) {
      resolvedKind = 'sale';
    }

    return this.invoiceService.findAll(
      companyId,
      page     ? parseInt(page, 10)     : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      startDate,
      endDate,
      batchId,
      employeeId,
      resolvedKind,
      supplierId,
      categoryId,
      expenseLineId,
      vaultId?.trim() || undefined,
      createdByUserId,
      sortBy,
      sortDir,
      q,
      includeCancelled === '1' || includeCancelled === 'true',
      hasNotes,
    );
  }

  @Get(':id')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async findOne(
    @Param('id')        id:        string,
    @Query('companyId') companyId: string,
  ) {
    return this.invoiceService.findOne(id, companyId);
  }

  @Patch(':id')
  @Roles('owner')
  async update(
    @Param('id')        id:        string,
    @Body()             dto:       UpdateInvoiceDto,
    @Query('companyId') companyId: string,
    @CurrentUser()      user:      JwtUser,
  ) {
    return this.invoiceService.update(id, dto, companyId, user.sub);
  }

  @Delete(':id')
  @Roles('owner')
  async remove(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.update(id, { status: 'cancelled' }, companyId, user.sub);
  }
}
