import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard }        from '@nestjs/passport';
import { RolesGuard }       from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { OcrInvoicesService } from './ocr-invoices.service';
import { ExtractInvoiceDto }    from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto }     from './dto/create-ocr-item.dto';
import { SaveInvoiceDto }       from './dto/save-invoice.dto';
import { SubmitOcrInvoiceDto }  from './dto/submit-ocr.dto';

@Controller('ocr')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OcrInvoicesController {
  constructor(private readonly svc: OcrInvoicesService) {}

  private requireCompanyId(companyId: string): string {
    const id = String(companyId || '').trim();
    if (!id) {
      throw new BadRequestException('يجب تحديد الشركة (companyId أو ترويسة x-company-id).');
    }
    return id;
  }

  // ─── OCR Extraction ───────────────────────────────────────────────────────

  @Post('extract')
  @RequirePermission('OCR_WRITE')
  async extract(
    @Body() dto: ExtractInvoiceDto,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.extractInvoice(user.tenantId!, this.requireCompanyId(companyId), dto);
  }

  @Post('submissions')
  @RequirePermission('OCR_SUBMIT')
  async submitForExtraction(
    @Body() dto: SubmitOcrInvoiceDto,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.submitForExtraction(
      user.tenantId!,
      this.requireCompanyId(companyId),
      user.sub,
      dto,
    );
  }

  @Post('invoices/:id/retry')
  @RequirePermission('OCR_WRITE')
  async retryInvoiceExtraction(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.retryExtractionForInvoice(
      user.tenantId!,
      this.requireCompanyId(companyId),
      id,
    );
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────

  @Get('invoices/review-queue')
  @RequirePermission('OCR_READ')
  async reviewQueue(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getReviewQueueInvoices(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Get('reports/purchases-by-month')
  @RequirePermission('OCR_READ')
  async purchasesByMonth(
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Query('month') month?: string,
  ) {
    return this.svc.getPurchasesMonthlyReport(user.tenantId!, this.requireCompanyId(companyId), month || '');
  }

  @Get('reports/operations-dashboard')
  @RequirePermission('OCR_READ')
  async operationsDashboard(
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Query('days') daysRaw?: string,
  ) {
    const days = daysRaw ? Number(daysRaw) : undefined;
    return this.svc.getOperationsDashboard(
      user.tenantId!,
      this.requireCompanyId(companyId),
      Number.isFinite(days) ? { days } : undefined,
    );
  }

  @Get('accounting-supplier-suggestions')
  @RequirePermission('OCR_READ')
  async accountingSupplierSuggestions(
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Query('ocrSupplierId') ocrSupplierId?: string,
    @Query('q') q?: string,
    @Query('invoiceVat') invoiceVat?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
    return this.svc.getAccountingSupplierSuggestions(user.tenantId!, this.requireCompanyId(companyId), {
      ocrSupplierId: ocrSupplierId?.trim() || undefined,
      q: q?.trim() || undefined,
      invoiceVat: invoiceVat?.trim() || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  /** قراءة ثابتة + JWT — لا تُحسب ضمن Throttle العام لتفادي 429 عند كاش الواجهة والمصغّرات */
  @Get('invoices/:id/image')
  @SkipThrottle()
  @RequirePermission('OCR_READ')
  async invoiceImage(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
    @Res() res: Response,
  ) {
    const abs = await this.svc.assertInvoiceImagePath(
      user.tenantId!,
      this.requireCompanyId(companyId),
      id,
    );
    res.sendFile(abs);
  }

  @Get('invoices/:id')
  @SkipThrottle()
  @RequirePermission('OCR_READ')
  async getInvoiceById(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.getInvoiceById(user.tenantId!, this.requireCompanyId(companyId), id);
  }

  @Get('invoices')
  @RequirePermission('OCR_READ')
  async getInvoices(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getInvoices(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Post('invoices')
  @RequirePermission('OCR_WRITE')
  async saveInvoice(
    @Body() dto: SaveInvoiceDto,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.saveInvoice(user.tenantId!, this.requireCompanyId(companyId), dto, {
      userId: user.sub,
      role: user.role,
      permissions: user.permissions,
    });
  }

  @Patch('invoices/:id/confirm')
  @RequirePermission('OCR_WRITE')
  async confirmInvoice(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.confirmInvoice(user.tenantId!, this.requireCompanyId(companyId), id, body.status);
  }

  @Post('invoices/bulk-delete')
  @RequirePermission('OCR_WRITE')
  async bulkDeleteInvoices(
    @Body() body: { ids: string[] },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.bulkDeleteInvoices(user.tenantId!, this.requireCompanyId(companyId), body.ids);
  }

  @Post('suppliers/bulk-delete')
  @RequirePermission('OCR_WRITE')
  async bulkDeleteSuppliers(
    @Body() body: { ids: string[] },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.bulkDeleteSuppliers(user.tenantId!, this.requireCompanyId(companyId), body.ids);
  }

  @Post('items/bulk-delete')
  @RequirePermission('OCR_WRITE')
  async bulkDeleteItems(
    @Body() body: { ids: string[] },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.bulkDeleteItems(user.tenantId!, this.requireCompanyId(companyId), body.ids);
  }

  @Post('price-history/bulk-delete')
  @RequirePermission('OCR_WRITE')
  async bulkDeletePriceHistory(
    @Body() body: { itemIds: string[] },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.bulkDeletePriceHistory(user.tenantId!, this.requireCompanyId(companyId), body.itemIds);
  }

  // ─── Suppliers ────────────────────────────────────────────────────────────

  @Get('suppliers')
  @RequirePermission('OCR_READ')
  async getSuppliers(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getSuppliers(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Post('suppliers')
  @RequirePermission('OCR_WRITE')
  async createSupplier(
    @Body() dto: CreateOcrSupplierDto,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.createSupplier(user.tenantId!, this.requireCompanyId(companyId), dto);
  }

  @Put('suppliers/:id')
  @RequirePermission('OCR_WRITE')
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOcrSupplierDto>,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.updateSupplier(user.tenantId!, this.requireCompanyId(companyId), id, dto);
  }

  @Delete('suppliers/:id')
  @RequirePermission('OCR_WRITE')
  async deleteSupplier(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.deleteSupplier(user.tenantId!, this.requireCompanyId(companyId), id);
  }

  @Post('suppliers/:id/aliases')
  @RequirePermission('OCR_WRITE')
  async addSupplierAlias(
    @Param('id') id: string,
    @Body() body: { alias: string; language?: string },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.addSupplierAlias(
      user.tenantId!,
      this.requireCompanyId(companyId),
      id,
      body.alias,
      body.language,
    );
  }

  // ─── Items ────────────────────────────────────────────────────────────────
  // ملاحظة: المسارات الثابتة (duplicates) قبل المسارات ذات :id

  @Get('items/duplicates')
  @RequirePermission('OCR_READ')
  async findDuplicateItems(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.findDuplicateItems(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Get('items')
  @RequirePermission('OCR_READ')
  async getItems(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getItems(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Post('items')
  @RequirePermission('OCR_WRITE')
  async createItem(
    @Body() dto: CreateOcrItemDto,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.createItem(user.tenantId!, this.requireCompanyId(companyId), dto);
  }

  @Put('items/:id')
  @RequirePermission('OCR_WRITE')
  async updateItem(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOcrItemDto>,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.updateItem(user.tenantId!, this.requireCompanyId(companyId), id, dto);
  }

  @Delete('items/:id')
  @RequirePermission('OCR_WRITE')
  async deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.deleteItem(user.tenantId!, this.requireCompanyId(companyId), id);
  }

  @Get('items/:id/price-history')
  @RequirePermission('OCR_READ')
  async getPriceHistory(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.getItemPriceHistory(user.tenantId!, this.requireCompanyId(companyId), id);
  }

  @Post('items/:id/aliases')
  @RequirePermission('OCR_WRITE')
  async addItemAlias(
    @Param('id') id: string,
    @Body() body: { alias: string; language?: string },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.addItemAlias(user.tenantId!, this.requireCompanyId(companyId), id, body.alias, body.language);
  }

  @Post('items/:keepId/merge/:mergeId')
  @RequirePermission('OCR_WRITE')
  async mergeItems(
    @Param('keepId') keepId: string,
    @Param('mergeId') mergeId: string,
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.mergeItems(user.tenantId!, this.requireCompanyId(companyId), keepId, mergeId);
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────

  @Get('price-alerts')
  @RequirePermission('OCR_READ')
  async getPriceAlerts(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getPriceAlerts(user.tenantId!, this.requireCompanyId(companyId));
  }

  // ─── Correction Rules ─────────────────────────────────────────────────────

  @Get('correction-rules')
  @RequirePermission('OCR_READ')
  async getCorrectionRules(@CurrentUser() user: JwtUser, @CompanyId() companyId: string) {
    return this.svc.getCorrectionRules(user.tenantId!, this.requireCompanyId(companyId));
  }

  @Patch('correction-rules/:id')
  @RequirePermission('OCR_WRITE')
  async updateCorrectionRule(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtUser,
    @CompanyId() companyId: string,
  ) {
    return this.svc.updateCorrectionRule(user.tenantId!, this.requireCompanyId(companyId), id, body.status);
  }
}
