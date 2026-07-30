import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { requireCompanyId } from '../common/utils/require-company-id';
import { OrdersService } from './orders.service';
import { OrdersStaffService } from './orders-staff.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductsBatchDto } from './dto/create-products-batch.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateStaffOrderDto } from './orders-staff.types';
import {
  type CurrentAuthUser,
  parseDaysQuery,
  parseOptionalYearMonth,
  parseRequiredDateRange,
  parseRequiredYearMonth,
  requireCurrentUserId,
} from './orders-controller-query.util';

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
  getMyStaffOrders(@CompanyId() companyId: string, @CurrentUser() user: CurrentAuthUser) {
    return this.staffService.getMyStaffOrders(requireCompanyId(companyId), requireCurrentUserId(user));
  }

  @Get('staff/sale-next-ref')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  peekStaffSaleNextLogRef(
    @CompanyId() companyId: string,
    @Query('saleDate') saleDate?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    if (!saleDate?.trim()) return { logRef: '' };
    return this.staffService.peekNextStaffSaleLogRef(resolvedCompanyId, saleDate.trim());
  }

  @Get('staff/sale-date-status')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  getStaffSaleDateStatus(
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Query('sectionName') sectionName?: string,
  ) {
    return this.staffService.getStaffSaleDateStatus(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      sectionName,
    );
  }

  @Get('sales/report')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getSalesReport(
    @CompanyId() companyId: string,
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = startDate || endDate ? parseRequiredDateRange(startDate, endDate) : null;
    return this.staffService.getSalesReport(
      requireCompanyId(companyId),
      range ?? parseDaysQuery(days),
    );
  }

  @Post('staff')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  createStaffOrder(
    @Body() body: CreateStaffOrderDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    return this.staffService.createStaffOrder(requireCurrentUserId(user), { ...body, companyId: requireCompanyId(companyId) });
  }

  @Patch('staff/:id')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  updateStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: Partial<CreateStaffOrderDto>,
  ) {
    return this.staffService.updateStaffOrder(id, requireCompanyId(companyId), requireCurrentUserId(user), body);
  }

  @Post('staff/:id/resend')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  resendStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: { lang?: 'ar' | 'en' },
  ) {
    return this.staffService.resendStaffOrder(id, requireCompanyId(companyId), requireCurrentUserId(user), body?.lang ?? 'ar');
  }

  @Delete('staff/:id')
  @RequirePermission('STAFF_ORDERS_SUBMIT')
  deleteStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    return this.staffService.deleteStaffOrder(id, requireCompanyId(companyId), requireCurrentUserId(user));
  }

  @Get()
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  findAll(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const ym = parseRequiredYearMonth(year, month);
    return this.ordersService.findAll(resolvedCompanyId, ym.year, ym.month);
  }

  @Get('summary')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getSummary(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const ym = parseRequiredYearMonth(year, month);
    return this.ordersService.getSummary(resolvedCompanyId, ym.year, ym.month);
  }

  @Get('range-summary')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getRangeSummary(
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const range = parseRequiredDateRange(startDate, endDate);
    return this.ordersService.getRangeSummary(resolvedCompanyId, range.startDate, range.endDate);
  }

  @Get('items-report')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  getItemsReport(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const ym = parseRequiredYearMonth(year, month);
    return this.ordersService.getItemsReport(resolvedCompanyId, ym.year, ym.month);
  }

  @Get('products')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT')
  getProducts(
    @CompanyId() companyId: string,
    @Query('section') section?: string,
    @Query('type') type?: string,
  ) {
    return this.ordersService.getProducts(requireCompanyId(companyId), section, type);
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
    const resolvedCompanyId = requireCompanyId(companyId);
    if (!productId?.trim()) {
      throw new BadRequestException('productId is required.');
    }
    const ym = parseOptionalYearMonth(year, month);
    return this.ordersService.getProductPurchaseHistory(resolvedCompanyId, productId, ym.year, ym.month);
  }

  @Get('category-history/:categoryId')
  @RequirePermission('VIEW_SALES')
  getCategoryPurchaseHistory(
    @Param('categoryId') categoryId: string,
    @CompanyId() companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    if (!categoryId?.trim()) {
      throw new BadRequestException('categoryId is required.');
    }
    const ym = parseOptionalYearMonth(year, month);
    return this.ordersService.getCategoryPurchaseHistory(resolvedCompanyId, categoryId, ym.year, ym.month);
  }

  @Get('categories')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT')
  getCategories(@CompanyId() companyId: string) {
    return this.ordersService.getCategories(requireCompanyId(companyId));
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
    return this.ordersService.updateCategory(id, requireCompanyId(companyId), body);
  }

  // ── Sections ──────────────────────────────────────────────────────

  @Get('sections')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE', 'STAFF_ORDERS_SUBMIT')
  getSections(@CompanyId() companyId: string) {
    return this.ordersService.getSections(requireCompanyId(companyId));
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
    return this.ordersService.updateSection(id, requireCompanyId(companyId), body);
  }

  @Delete('sections/:id')
  @RequirePermission('VIEW_SALES')
  deleteSection(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.deleteSection(id, requireCompanyId(companyId));
  }

  @Post('products/bulk-sections')
  @RequirePermission('VIEW_SALES')
  bulkSetProductSections(
    @CompanyId() companyId: string,
    @Body() body: { productIds: string[]; sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' },
  ) {
    return this.ordersService.bulkSetProductSections(requireCompanyId(companyId), body.productIds, {
      sectionNames: body.sectionNames,
      sectionIds: body.sectionIds,
      mode: body.mode,
    });
  }

  @Get(':id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_READ', 'ORDERS_WRITE')
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.findOne(id, requireCompanyId(companyId));
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
    return this.ordersService.update(requireCompanyId(companyId), id, body);
  }

  @Delete(':id')
  @RequirePermission('VIEW_SALES')
  cancel(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.cancel(id, requireCompanyId(companyId));
  }

  @Post()
  @RequirePermission('VIEW_SALES')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body.companyId, body);
  }
}
