/**
 * InvoiceController — فواتير المشتريات والمصروفات
 *
 * الصلاحيات:
 *   POST   → INVOICES_WRITE  (owner | super_admin | accountant | cashier)
 *   GET    → INVOICES_READ   (owner | super_admin | accountant | cashier)
 *   PATCH  → INVOICES_WRITE  (owner | super_admin | accountant)
 */
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }             from '@nestjs/passport';
import { CompanyAccessGuard }    from '../auth/guards/company-access.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser }  from '../auth/decorators/current-user.decorator';
import { RequirePermission }     from '../auth/decorators/require-permission.decorator';
import { CreateInvoiceDto }      from './dto/create-invoice.dto';
import { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { UpdateInvoiceDto }      from './dto/update-invoice.dto';
import { InvoiceService }        from './invoice.service';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @RequirePermission('INVOICES_WRITE')
  async create(
    @Body()        dto:  CreateInvoiceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.createWithLedger(dto, user.sub);
  }

  @Post('batch')
  @RequirePermission('INVOICES_WRITE')
  async createBatch(
    @Body()        dto:  CreateInvoiceBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.createBatchWithLedger(dto, user.sub);
  }

  @Get('purchase-batch-summaries')
  @RequirePermission('INVOICES_READ')
  async purchaseBatchSummaries(
    @Query('companyId') companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
  ) {
    if (!companyId) return { batches: [], rowCount: 0 };
    return this.invoiceService.findPurchaseBatchSummaries(companyId, startDate, endDate);
  }

  @Get()
  @RequirePermission('INVOICES_READ')
  async findAll(
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
    @Query('sortBy')      sortBy?:     string,
    @Query('sortDir')     sortDir?:    string,
  ) {
    return this.invoiceService.findAll(
      companyId,
      page     ? parseInt(page, 10)     : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      startDate,
      endDate,
      batchId,
      employeeId,
      kind,
      supplierId,
      categoryId,
      expenseLineId,
      sortBy,
      sortDir,
    );
  }

  @Get(':id')
  @RequirePermission('INVOICES_READ')
  async findOne(
    @Param('id')        id:        string,
    @Query('companyId') companyId: string,
  ) {
    return this.invoiceService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermission('INVOICES_WRITE')
  async update(
    @Param('id')        id:        string,
    @Body()             dto:       UpdateInvoiceDto,
    @Query('companyId') companyId: string,
    @CurrentUser()      user:      JwtUser,
  ) {
    return this.invoiceService.update(id, dto, companyId, user.sub);
  }
}
