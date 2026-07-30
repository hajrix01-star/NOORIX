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
  resolveCurrentUserPermissions,
  resolveCurrentUserRole,
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
  @RequireAnyPermission('ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT', 'STAFF_ORDERS_READ')
  getMyStaffOrders(@CompanyId() companyId: string, @CurrentUser() user: CurrentAuthUser) {
    return this.staffService.getMyStaffOrders(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      30,
      resolveCurrentUserRole(user),
      resolveCurrentUserPermissions(user),
    );
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
  @RequirePermission('STAFF_ORDERS_READ')
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
  @RequireAnyPermission('ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  createStaffOrder(
    @Body() body: CreateStaffOrderDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    return this.staffService.createStaffOrder(
      requireCurrentUserId(user),
      { ...body, companyId: requireCompanyId(companyId) },
      resolveCurrentUserRole(user),
      resolveCurrentUserPermissions(user),
    );
  }

  @Patch('staff/:id')
  @RequireAnyPermission('ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  updateStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: Partial<CreateStaffOrderDto>,
  ) {
    return this.staffService.updateStaffOrder(
      id,
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      resolveCurrentUserRole(user),
      resolveCurrentUserPermissions(user),
      body,
    );
  }

  @Post('staff/:id/resend')
  @RequireAnyPermission('ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  resendStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: { lang?: 'ar' | 'en' },
  ) {
    return this.staffService.resendStaffOrder(
      id,
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      body?.lang ?? 'ar',
      resolveCurrentUserRole(user),
      resolveCurrentUserPermissions(user),
    );
  }

  @Delete('staff/:id')
  @RequireAnyPermission('ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  deleteStaffOrder(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
  ) {
    return this.staffService.deleteStaffOrder(
      id,
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      resolveCurrentUserRole(user),
      resolveCurrentUserPermissions(user),
    );
  }

  @Get()
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
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
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
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
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
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
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  getItemsReport(
    @CompanyId() companyId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const ym = parseRequiredYearMonth(year, month);
    return this.ordersService.getItemsReport(resolvedCompanyId, ym.year, ym.month);
  }

  @Get('items-report-range')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  getItemsReportRange(
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    const range = parseRequiredDateRange(startDate, endDate);
    return this.ordersService.getItemsReportRange(
      resolvedCompanyId,
      range.startDate,
      range.endDate,
    );
  }

  @Get('products')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE', 'ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  getProducts(
    @CompanyId() companyId: string,
    @Query('section') section?: string,
    @Query('type') type?: string,
  ) {
    return this.ordersService.getProducts(requireCompanyId(companyId), section, type);
  }

  @Post('products')
  @RequirePermission('ORDERS_WRITE')
  createProduct(@Body() body: CreateProductDto) {
    return this.ordersService.createProduct(body.companyId, body);
  }

  @Post('products/batch')
  @RequirePermission('ORDERS_WRITE')
  createProductsBatch(@Body() body: CreateProductsBatchDto) {
    return this.ordersService.createProductsBatch(body.companyId, body.products);
  }

  @Post('categories/batch')
  @RequirePermission('ORDERS_WRITE')
  createCategoriesBatch(@Body() body: { companyId: string; categories: { nameAr: string; nameEn?: string; sortOrder?: number }[] }) {
    return this.ordersService.createCategoriesBatch(body.companyId, body.categories);
  }

  @Patch('products/:id')
  @RequirePermission('ORDERS_WRITE')
  updateProduct(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.ordersService.updateProduct(id, companyId, body);
  }

  @Get('product-history/:productId')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  getProductPurchaseHistory(
    @Param('productId') productId: string,
    @CompanyId() companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    if (!productId?.trim()) {
      throw new BadRequestException('productId is required.');
    }
    const ym = parseOptionalYearMonth(year, month);
    const range = startDate || endDate ? parseRequiredDateRange(startDate, endDate) : undefined;
    return this.ordersService.getProductPurchaseHistory(
      resolvedCompanyId,
      productId,
      ym.year,
      ym.month,
      range?.startDate,
      range?.endDate,
    );
  }

  @Get('category-history/:categoryId')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  getCategoryPurchaseHistory(
    @Param('categoryId') categoryId: string,
    @CompanyId() companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    if (!categoryId?.trim()) {
      throw new BadRequestException('categoryId is required.');
    }
    const ym = parseOptionalYearMonth(year, month);
    const range = startDate || endDate ? parseRequiredDateRange(startDate, endDate) : undefined;
    return this.ordersService.getCategoryPurchaseHistory(
      resolvedCompanyId,
      categoryId,
      ym.year,
      ym.month,
      range?.startDate,
      range?.endDate,
    );
  }

  @Get('categories')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE', 'ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  getCategories(@CompanyId() companyId: string) {
    return this.ordersService.getCategories(requireCompanyId(companyId));
  }

  @Post('categories')
  @RequirePermission('ORDERS_WRITE')
  createCategory(@Body() body: { companyId: string; nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.ordersService.createCategory(body.companyId, body);
  }

  @Patch('categories/:id')
  @RequirePermission('ORDERS_WRITE')
  updateCategory(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    return this.ordersService.updateCategory(id, requireCompanyId(companyId), body);
  }

  // ── Sections ──────────────────────────────────────────────────────

  @Get('sections')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE', 'ORDERS_STAFF_SUBMIT', 'STAFF_ORDERS_SUBMIT')
  getSections(@CompanyId() companyId: string) {
    return this.ordersService.getSections(requireCompanyId(companyId));
  }

  @Post('sections')
  @RequirePermission('ORDERS_WRITE')
  createSection(@Body() body: { companyId: string; nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.ordersService.createSection(body.companyId, body);
  }

  @Patch('sections/:id')
  @RequirePermission('ORDERS_WRITE')
  updateSection(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number },
  ) {
    return this.ordersService.updateSection(id, requireCompanyId(companyId), body);
  }

  @Delete('sections/:id')
  @RequirePermission('ORDERS_DELETE')
  deleteSection(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.deleteSection(id, requireCompanyId(companyId));
  }

  @Post('products/bulk-sections')
  @RequirePermission('ORDERS_WRITE')
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
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.findOne(id, requireCompanyId(companyId));
  }

  @Patch(':id')
  @RequirePermission('ORDERS_WRITE')
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
  @RequirePermission('ORDERS_DELETE')
  cancel(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.cancel(id, requireCompanyId(companyId));
  }

  @Post()
  @RequirePermission('ORDERS_WRITE')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body.companyId, body);
  }
}
