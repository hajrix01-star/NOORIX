import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { OrdersService } from './orders.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductsBatchDto } from './dto/create-products-batch.dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermission('VIEW_SALES')
  findAll(
    @Query('companyId') companyId: string,
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
  @RequirePermission('VIEW_SALES')
  getSummary(
    @Query('companyId') companyId: string,
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
  @RequirePermission('VIEW_SALES')
  getItemsReport(
    @Query('companyId') companyId: string,
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
  @RequirePermission('VIEW_SALES')
  getProducts(@Query('companyId') companyId: string) {
    if (!companyId) return [];
    return this.ordersService.getProducts(companyId);
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
    @Query('companyId') companyId: string,
    @Body() body: UpdateProductDto,
  ) {
    return this.ordersService.updateProduct(id, companyId, body);
  }

  @Get('product-history/:productId')
  @RequirePermission('VIEW_SALES')
  getProductPurchaseHistory(
    @Param('productId') productId: string,
    @Query('companyId') companyId: string,
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
    @Query('companyId') companyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    if (!companyId || !categoryId) return [];
    const y = year ? parseInt(year, 10) : undefined;
    const m = month ? parseInt(month, 10) : undefined;
    return this.ordersService.getCategoryPurchaseHistory(companyId, categoryId, y, m);
  }

  @Get('categories')
  @RequirePermission('VIEW_SALES')
  getCategories(@Query('companyId') companyId: string) {
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
    @Query('companyId') companyId: string,
    @Body() body: { nameAr?: string; nameEn?: string | null; sortOrder?: number; isActive?: boolean },
  ) {
    return this.ordersService.updateCategory(id, companyId || '', body);
  }

  @Get(':id')
  @RequirePermission('VIEW_SALES')
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.ordersService.findOne(id, companyId);
  }

  @Patch(':id')
  @RequirePermission('VIEW_SALES')
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
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
  cancel(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.ordersService.cancel(id, companyId);
  }

  @Post()
  @RequirePermission('VIEW_SALES')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body.companyId, body);
  }
}
