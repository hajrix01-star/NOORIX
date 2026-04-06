import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards,
} from '@nestjs/common';
import { AuthGuard }        from '@nestjs/passport';
import { RolesGuard }       from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { SkipCompanyCheck } from '../auth/decorators/skip-company-check.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { OcrInvoicesService } from './ocr-invoices.service';
import { ExtractInvoiceDto }    from './dto/extract-invoice.dto';
import { CreateOcrSupplierDto } from './dto/create-ocr-supplier.dto';
import { CreateOcrItemDto }     from './dto/create-ocr-item.dto';
import { SaveInvoiceDto }       from './dto/save-invoice.dto';

@Controller('ocr')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
@SkipCompanyCheck()
export class OcrInvoicesController {
  constructor(private readonly svc: OcrInvoicesService) {}

  // ─── OCR Extraction ───────────────────────────────────────────────────────

  @Post('extract')
  @RequirePermission('OCR_WRITE')
  async extract(@Body() dto: ExtractInvoiceDto, @CurrentUser() user: JwtUser) {
    return this.svc.extractInvoice(user.tenantId!, dto);
  }

  // ─── Invoices ─────────────────────────────────────────────────────────────

  @Get('invoices')
  @RequirePermission('OCR_READ')
  async getInvoices(@CurrentUser() user: JwtUser) {
    return this.svc.getInvoices(user.tenantId!);
  }

  @Post('invoices')
  @RequirePermission('OCR_WRITE')
  async saveInvoice(@Body() dto: SaveInvoiceDto, @CurrentUser() user: JwtUser) {
    return this.svc.saveInvoice(user.tenantId!, dto);
  }

  @Patch('invoices/:id/confirm')
  @RequirePermission('OCR_WRITE')
  async confirmInvoice(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.confirmInvoice(user.tenantId!, id, body.status);
  }

  // ─── Suppliers ────────────────────────────────────────────────────────────

  @Get('suppliers')
  @RequirePermission('OCR_READ')
  async getSuppliers(@CurrentUser() user: JwtUser) {
    return this.svc.getSuppliers(user.tenantId!);
  }

  @Post('suppliers')
  @RequirePermission('OCR_WRITE')
  async createSupplier(@Body() dto: CreateOcrSupplierDto, @CurrentUser() user: JwtUser) {
    return this.svc.createSupplier(user.tenantId!, dto);
  }

  @Put('suppliers/:id')
  @RequirePermission('OCR_WRITE')
  async updateSupplier(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOcrSupplierDto>,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.updateSupplier(user.tenantId!, id, dto);
  }

  @Delete('suppliers/:id')
  @RequirePermission('OCR_WRITE')
  async deleteSupplier(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.deleteSupplier(user.tenantId!, id);
  }

  @Post('suppliers/:id/aliases')
  @RequirePermission('OCR_WRITE')
  async addSupplierAlias(
    @Param('id') id: string,
    @Body() body: { alias: string; language?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.addSupplierAlias(user.tenantId!, id, body.alias, body.language);
  }

  // ─── Items ────────────────────────────────────────────────────────────────

  @Get('items')
  @RequirePermission('OCR_READ')
  async getItems(@CurrentUser() user: JwtUser) {
    return this.svc.getItems(user.tenantId!);
  }

  @Post('items')
  @RequirePermission('OCR_WRITE')
  async createItem(@Body() dto: CreateOcrItemDto, @CurrentUser() user: JwtUser) {
    return this.svc.createItem(user.tenantId!, dto);
  }

  @Put('items/:id')
  @RequirePermission('OCR_WRITE')
  async updateItem(
    @Param('id') id: string,
    @Body() dto: Partial<CreateOcrItemDto>,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.updateItem(user.tenantId!, id, dto);
  }

  @Delete('items/:id')
  @RequirePermission('OCR_WRITE')
  async deleteItem(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.deleteItem(user.tenantId!, id);
  }

  @Get('items/:id/price-history')
  @RequirePermission('OCR_READ')
  async getPriceHistory(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.getItemPriceHistory(user.tenantId!, id);
  }

  @Post('items/:id/aliases')
  @RequirePermission('OCR_WRITE')
  async addItemAlias(
    @Param('id') id: string,
    @Body() body: { alias: string; language?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.addItemAlias(user.tenantId!, id, body.alias, body.language);
  }

  @Get('items/duplicates')
  @RequirePermission('OCR_READ')
  async findDuplicateItems(@CurrentUser() user: JwtUser) {
    return this.svc.findDuplicateItems(user.tenantId!);
  }

  @Post('items/:keepId/merge/:mergeId')
  @RequirePermission('OCR_WRITE')
  async mergeItems(
    @Param('keepId') keepId: string,
    @Param('mergeId') mergeId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.mergeItems(user.tenantId!, keepId, mergeId);
  }

  // ─── Price Alerts ─────────────────────────────────────────────────────────

  @Get('price-alerts')
  @RequirePermission('OCR_READ')
  async getPriceAlerts(@CurrentUser() user: JwtUser) {
    return this.svc.getPriceAlerts(user.tenantId!);
  }

  // ─── Correction Rules ─────────────────────────────────────────────────────

  @Get('correction-rules')
  @RequirePermission('OCR_READ')
  async getCorrectionRules(@CurrentUser() user: JwtUser) {
    return this.svc.getCorrectionRules(user.tenantId!);
  }

  @Patch('correction-rules/:id')
  @RequirePermission('OCR_WRITE')
  async updateCorrectionRule(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.updateCorrectionRule(user.tenantId!, id, body.status);
  }
}
