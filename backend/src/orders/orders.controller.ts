import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { OrdersService } from './orders.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductsBatchDto } from './dto/create-products-batch.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateStaffOrderDto, MarkStaffDigestDto, UpdateStaffOrderDto } from './dto/create-staff-order.dto';

type JwtUser = { userId?: string; sub?: string };

@Controller('orders')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private uid(req: { user?: JwtUser }): string {
    return req.user?.userId || req.user?.sub || '';
  }

  @Get()
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
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
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
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
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
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

  @Get('staff/my')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  listStaffMine(
    @CompanyId() companyId: string,
    @Req() req: { user?: JwtUser },
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const uid = this.uid(req);
    if (!companyId || !uid || !year || !month) return [];
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return [];
    return this.ordersService.listStaffOwnRequests(companyId, uid, y, m);
  }

  @Post('staff')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  createStaff(@CompanyId() companyId: string, @Req() req: { user?: JwtUser }, @Body() body: CreateStaffOrderDto) {
    return this.ordersService.createStaffRequest(companyId, this.uid(req), body);
  }

  @Patch('staff/:id')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  updateStaff(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Req() req: { user?: JwtUser },
    @Body() body: UpdateStaffOrderDto,
  ) {
    return this.ordersService.updateStaffRequest(companyId, this.uid(req), id, body);
  }

  @Delete('staff/:id')
  @RequirePermission('ORDERS_STAFF_PORTAL')
  cancelStaff(@Param('id') id: string, @CompanyId() companyId: string, @Req() req: { user?: JwtUser }) {
    return this.ordersService.cancelStaffOwnRequest(companyId, this.uid(req), id);
  }

  @Post('staff/mark-digest-sent')
  @RequirePermission('ORDERS_WRITE')
  markStaffDigest(@Body() body: MarkStaffDigestDto) {
    return this.ordersService.markStaffDigestSent(body.companyId, body.orderIds);
  }

  @Get('products')
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ', 'ORDERS_STAFF_PORTAL')
  getProducts(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.ordersService.getProducts(companyId);
  }

  @Post('products')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  createProduct(@Body() body: CreateProductDto) {
    return this.ordersService.createProduct(body.companyId, body);
  }

  @Post('products/batch')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  createProductsBatch(@Body() body: CreateProductsBatchDto) {
    return this.ordersService.createProductsBatch(body.companyId, body.products);
  }

  @Post('categories/batch')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  createCategoriesBatch(@Body() body: { companyId: string; categories: { nameAr: string; nameEn?: string; sortOrder?: number }[] }) {
    return this.ordersService.createCategoriesBatch(body.companyId, body.categories);
  }

  @Patch('products/:id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  updateProduct(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.ordersService.updateProduct(id, companyId, body);
  }

  @Get('product-history/:productId')
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
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
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
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
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
  getCategories(@CompanyId() companyId: string) {
    if (!companyId) return [];
    return this.ordersService.getCategories(companyId);
  }

  @Post('categories')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  createCategory(@Body() body: { companyId: string; nameAr: string; nameEn?: string; sortOrder?: number }) {
    return this.ordersService.createCategory(body.companyId, body);
  }

  @Patch('categories/:id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  updateCategory(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    return this.ordersService.updateCategory(id, companyId || '', body);
  }

  @Get(':id')
  @RequireAnyPermission('VIEW_SALES', 'VIEW_ORDERS', 'ORDERS_READ')
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: {
      orderDate?: string;
      orderType?: 'external' | 'internal';
      pettyCashAmount?: string;
      notes?: string;
      items?: { productId: string; size?: string; packaging?: string; unit?: string; quantity: string; unitPrice: string }[];
    },
  ) {
    return this.ordersService.update(companyId, id, body);
  }

  @Delete(':id')
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE', 'ORDERS_DELETE')
  cancel(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.ordersService.cancel(id, companyId);
  }

  @Post()
  @RequireAnyPermission('VIEW_SALES', 'ORDERS_WRITE')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body.companyId, body);
  }
}
