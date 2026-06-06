import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductsBatchDto } from './dto/create-products-batch.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly staffService: OrdersStaffService,
  ) {}

  // ══════════════════════════════════════════════════
  // STAFF ORDERS — طلبات الأقسام
  // يجب أن تكون قبل routes الـ wildcard /:id
  // ══════════════════════════════════════════════════

  @Get('staff/my')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  getMyStaffOrders(@CompanyId() companyId: string, @CurrentUser() user: any) {
    if (!companyId) return [];
    return this.staffService.getMyStaffOrders(companyId, user.sub);
  }

  @Get('staff/digest')
  @RequirePermission('STAFF_ORDERS_DIGEST')
  getStaffDigest(@CompanyId() companyId: string) {
    if (!companyId) return { sections: [], totalOrders: 0, pendingCount: 0 };
    return this.staffService.getDigest(companyId);
  }

  @Get('staff/digest/history')
  @RequirePermission('STAFF_ORDERS_DIGEST')
  getDigestHistory(
    @CompanyId() companyId: string,
    @Query('days') days?: string,
  ) {
    if (!companyId) return [];
    return this.staffService.getDigestHistory(companyId, days ? parseInt(days, 10) : 30);
  }

  @Get('sales/report')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_DIGEST')
  getSalesReport(
    @CompanyId() companyId: string,
    @Query('days') days?: string,
  ) {
    if (!companyId) return { summary: {}, byProduct: [], bySection: [], byUser: [], byDay: [] };
    return this.staffService.getSalesReport(companyId, days ? parseInt(days, 10) : 30);
  }

  @Post('staff')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  createStaffOrder(@Body() body: any, @CurrentUser() user: any) {
    return this.staffService.createStaffOrder(user.sub, body);
  }

  @Post('staff/send-digest')
  @RequirePermission('STAFF_ORDERS_DIGEST')
  sendStaffDigest(
    @CompanyId() companyId: string,
    @Body() body: {
      orderIds?: string[];
      lang?: 'ar' | 'en';
      orderType?: 'external' | 'internal';
      pettyCashAmount?: string;
      orderDate?: string;
      createPurchaseOrder?: boolean;
    },
  ) {
    if (!companyId) throw new Error('companyId مطلوب');
    return this.staffService.sendDigest(companyId, body?.orderIds, {
      lang: body?.lang ?? 'ar',
      orderType: body?.orderType,
      pettyCashAmount: body?.pettyCashAmount,
      orderDate: body?.orderDate,
      createPurchaseOrder: body?.createPurchaseOrder,
    });
  }

  @Patch('staff/:id')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  updateStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.staffService.updateStaffOrder(id, companyId, user.sub, body);
  }

  @Post('staff/:id/resend')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  resendStaffSale(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: any,
    @Body() body: { lang?: 'ar' | 'en' },
  ) {
    return this.staffService.resendStaffSale(id, companyId, user.sub, body?.lang ?? 'ar');
  }

  @Delete('staff/:id')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  deleteStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: any,
  ) {
    return this.staffService.deleteStaffOrder(id, companyId, user.sub);
  }

  @Get()
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  findAll(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    if (!companyId || !year || !month) return [];
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return [];
    return this.ordersService.findAll(companyId, y, m);
  }

  @Get('summary')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getSummary(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    if (!companyId || !year || !month) return {};
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return {};
    return this.ordersService.getSummary(companyId, y, m);
  }

  @Get('items-report')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getItemsReport(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    if (!companyId || !year || !month) return [];
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return [];
    return this.ordersService.getItemsReport(companyId, y, m);
  }

  @Get('products')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT', 'STAFF_ORDERS_DIGEST')
  getProducts(
    @CompanyId() companyId: string,
    @Query('section') section?: string,
    @Query('type') type?: string,
  ) {
    if (!companyId) return [];
    return this.ordersService.getProducts(companyId, section, type);
  }

  @Post('products')
  @RequirePermission('VIEW_SALES')
  createProduct(@Body() body: CreateProductDto) {
    return this.ordersService.createProduct(body.companyId, body);
  }

  @Post('products/batch')
  @RequirePermission('VIEW_SALES')
  createProductsBatch(@Body() body: CreateProductsBatchDto) {
    return this.ordersService.createProductsBatch(body.companyId, body.products);
  }

  @Post('categories/batch')
  @RequirePermission('VIEW_SALES')
  createCategoriesBatch(@Body() body: { companyId: string; categories: { nameAr: string; nameEn?: string; sortOrder?: number }[] }) {
    return this.ordersService.createCategoriesBatch(body.companyId, body.categories);
  }

  @Patch('products/:id')
  @RequirePermission('VIEW_SALES')
  updateProduct(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.ordersService.updateProduct(id, companyId, body);
  }

  @Get('product-history/:productId')
  @RequirePermission('VIEW_SALES')
  getProductPurchaseHistory(
    @Param('productId') productId: string,
    @CompanyId() companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    if (!companyId || !productId) return [];
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.ordersService.getProductPurchaseHistory(companyId, productId, y, m);
  }

  @Get('category-history/:categoryId')
  @RequirePermission('VIEW_SALES')
  getCategoryPurchaseHistory(
    @Param('categoryId') categoryId: string,
    @CompanyId() companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    if (!companyId || !categoryId) return [];
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.ordersService.getCategoryPurchaseHistory(companyId, categoryId, y, m);
  }

  @Get('categories')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT', 'STAFF_ORDERS_DIGEST')
  getCategories(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.ordersService.getCategories(companyId);
  }

  @Post('categories')
  @RequirePermission('VIEW_SALES')
  createCategory(@Body() body: { companyId: string; nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.ordersService.createCategory(body.companyId, body);
  }

  @Patch('categories/:id')
  @RequirePermission('VIEW_SALES')
  updateCategory(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    return this.ordersService.updateCategory(id, companyId || '', body);
  }

  // ── Sections ──────────────────────────────────────────────────────

  @Get('sections')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT', 'STAFF_ORDERS_DIGEST')
  getSections(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.ordersService.getSections(companyId);
  }

  @Post('sections')
  @RequirePermission('VIEW_SALES')
  createSection(@Body() body: { companyId: string; nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.ordersService.createSection(body.companyId, body);
  }

  @Patch('sections/:id')
  @RequirePermission('VIEW_SALES')
  updateSection(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number },
  ) {
    return this.ordersService.updateSection(id, companyId || '', body);
  }

  @Delete('sections/:id')
  @RequirePermission('VIEW_SALES')
  deleteSection(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.deleteSection(id, companyId || '');
  }

  @Post('products/bulk-sections')
  @RequirePermission('VIEW_SALES')
  bulkSetProductSections(
    @CompanyId() companyId: string,
    @Body() body: { productIds: string[]; sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
  ) {
    return this.ordersService.bulkSetProductSections(companyId || '', body.productIds, {
      sectionNames: body.sectionNames,
      sectionIds: body.sectionIds,
      mode: body.mode,
    });
  }

  @Get(':id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermission('VIEW_SALES')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: {
      orderDate?: string;
      orderType?: 'external' | 'internal';
      pettyCashAmount?: string;
      notes?: string;
      items?: { productId: string; size?: string; quantity: string; unitPrice: string }[];
    },
  ) {
    return this.ordersService.update(companyId, id, body);
  }

  @Delete(':id')
  @RequirePermission('VIEW_SALES')
  cancel(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.cancel(id, companyId);
  }

  @Post()
  @RequirePermission('VIEW_SALES')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body.companyId, body);
  }
}
