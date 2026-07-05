/**
 * InvoiceController — فواتير المبيعات والمشتريات والمصروفات
 *
 * الصلاحيات:
 *   POST → INVOICES_WRITE أو PURCHASES_WRITE
 *   PATCH (تعديل فاتورة) → المالك فقط
 *   GET → INVOICES_READ أو PURCHASES_READ
 *         (بدون kind في الاستعلام: مبيعات فقط / صرف كامل / الاثنان معاً — انظر resolveInvoiceListKindFilter)
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { FileInterceptor }       from '@nestjs/platform-express';
import type { Response }         from 'express';
import { AuthGuard }             from '@nestjs/passport';
import { CompanyAccessGuard }    from '../auth/guards/company-access.guard';
import { RolesGuard }            from '../auth/guards/roles.guard';
import { CurrentUser, JwtUser }  from '../auth/decorators/current-user.decorator';
import { RequirePermission }     from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission }  from '../auth/decorators/require-any-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { requireCompanyId }     from '../common/utils/require-company-id';
import { CreateInvoiceDto }      from './dto/create-invoice.dto';
import { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { UpdateInvoiceDto }      from './dto/update-invoice.dto';
import { InvoiceListQueryDto } from './dto/invoice-list-query.dto';
import { InvoiceService }        from './invoice.service';
import { resolveInvoiceListKindFilter } from './invoice-list-resolved-kind.util';
import { normalizeInvoiceListQuery } from './invoice-list-query-contract.util';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @RequireAnyPermission(
    'INVOICES_WRITE',
    'PURCHASES_WRITE',
    'CHAT_PRESET_ADVANCES',
    'CHAT_PRESET_EXPENSE_PAY',
  )
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
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate')   endDate?:   string,
    @Query('q')         q?:         string,
    @Query('lang')      lang?:      string,
  ) {
    return this.invoiceService.findPurchaseBatchSummaries(requireCompanyId(companyId), startDate, endDate, q, lang);
  }

  @Get('day-close-report')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async dayCloseReport(
    @CompanyId() companyId: string,
    @Query('date')     date:      string,
  ) {
    return this.invoiceService.getDayCloseReport(requireCompanyId(companyId), date);
  }

  /** مستخدمو النظام الظاهرون كمنشئين لفواتير الشركة — لفلتر القائمة */
  @Get('creator-filter-options')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async creatorFilterOptions(@CompanyId() companyId: string) {
    return this.invoiceService.getCreatorFilterOptions(requireCompanyId(companyId));
  }

  @Get()
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async findAll(
    @CurrentUser()        user:        JwtUser,
    @CompanyId() companyId: string,
    @Query() query: InvoiceListQueryDto,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const role  = (user?.role  || '').toLowerCase();
    const perms = user?.permissions || [];

    const canSales     = hasPermission(role, 'INVOICES_READ',  perms);
    const canPurchases = hasPermission(role, 'PURCHASES_READ', perms);
    const canHr        =
      hasPermission(role, PERMISSIONS.HR_READ, perms) ||
      hasPermission(role, PERMISSIONS.HR_WRITE, perms);

    const resolvedKind = resolveInvoiceListKindFilter({
      requestedKind: query.kind,
      canSales,
      canPurchases,
      canHr,
    });

    const includeExecSummary = hasPermission(
      role,
      PERMISSIONS.INVOICES_VIEW_EXEC_SUMMARY,
      perms,
    );

    return this.invoiceService.findAll(
      normalizeInvoiceListQuery(
        resolvedCompanyId,
        query,
        resolvedKind,
      ),
      includeExecSummary,
    );
  }

  @Get(':id/attachment/download')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async downloadAttachment(
    @Param('id')        id:        string,
    @CompanyId() companyId: string,
    @Res()              res:       Response,
  ) {
    return this.invoiceService.downloadAttachment(id, requireCompanyId(companyId), res);
  }

  @Post(':id/attachment')
  @RequireAnyPermission('INVOICES_WRITE', 'PURCHASES_WRITE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @Param('id')        id:        string,
    @CompanyId() companyId: string,
    @UploadedFile()    file:       Express.Multer.File,
    @CurrentUser()      user:      JwtUser,
  ) {
    return this.invoiceService.saveAttachment(id, requireCompanyId(companyId), file, user.sub);
  }

  @Delete(':id/attachment')
  @RequireAnyPermission('INVOICES_WRITE', 'PURCHASES_WRITE')
  async deleteAttachment(
    @Param('id')        id:        string,
    @CompanyId() companyId: string,
    @CurrentUser()      user:      JwtUser,
  ) {
    return this.invoiceService.removeAttachment(id, requireCompanyId(companyId), user.sub);
  }

  @Get(':id')
  @RequireAnyPermission('INVOICES_READ', 'PURCHASES_READ')
  async findOne(
    @Param('id')        id:        string,
    @CompanyId() companyId: string,
  ) {
    return this.invoiceService.findOne(id, requireCompanyId(companyId));
  }

  @Patch(':id')
  @Roles('owner')
  async update(
    @Param('id')        id:        string,
    @Body()             dto:       UpdateInvoiceDto,
    @CompanyId() companyId: string,
    @CurrentUser()      user:      JwtUser,
  ) {
    return this.invoiceService.update(id, dto, requireCompanyId(companyId), user.sub);
  }

  @Delete(':id')
  @Roles('owner')
  async remove(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.invoiceService.update(id, { status: 'cancelled' }, requireCompanyId(companyId), user.sub);
  }
}
