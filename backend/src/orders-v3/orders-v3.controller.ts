import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { hasPermission, PERMISSIONS, type Permission } from '../auth/constants/permissions';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { requireCompanyId } from '../common/utils/require-company-id';
import { OrdersV3CatalogService } from './orders-v3-catalog.service';
import type {
  OrdersV3ConversionPublishInput,
  OrdersV3DocumentInput,
  OrdersV3DocumentType,
  OrdersV3ItemInput,
  OrdersV3NamedInput,
  OrdersV3RecipePublishInput,
  OrdersV3StocktakeInput,
  OrdersV3UnitInput,
} from './orders-v3.contracts';
import { OrdersV3DocumentsService } from './orders-v3-documents.service';
import { OrdersV3InventoryService } from './orders-v3-inventory.service';
import { OrdersV3ReportsService } from './orders-v3-reports.service';

function userCan(user: JwtUser, permission: Permission): boolean {
  return hasPermission(user.role, permission, user.permissions);
}

function submitPermission(documentType: OrdersV3DocumentType): Permission {
  return documentType === 'purchase'
    ? PERMISSIONS.ORDERS_V3_STAFF_SUBMIT
    : PERMISSIONS.ORDERS_V3_INTERNAL_SUBMIT;
}

@Controller('orders-v3')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersV3Controller {
  constructor(
    private readonly catalog: OrdersV3CatalogService,
    private readonly documents: OrdersV3DocumentsService,
    private readonly inventory: OrdersV3InventoryService,
    private readonly reports: OrdersV3ReportsService,
  ) {}

  @Get('bootstrap')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_WRITE', 'ORDERS_V3_STAFF_SUBMIT', 'ORDERS_V3_INTERNAL_SUBMIT', 'ORDERS_V3_REPORTS_READ', 'ORDERS_V3_INVENTORY_WRITE')
  bootstrap(@CompanyId() companyId: string) {
    return this.catalog.getBootstrap(requireCompanyId(companyId));
  }

  @Post('catalog/units')
  @RequirePermission('ORDERS_V3_WRITE')
  createUnit(@CompanyId() companyId: string, @Body() body: OrdersV3UnitInput) {
    return this.catalog.createUnit(requireCompanyId(companyId), body);
  }

  @Post('catalog/categories')
  @RequirePermission('ORDERS_V3_WRITE')
  createCategory(@CompanyId() companyId: string, @Body() body: OrdersV3NamedInput) {
    return this.catalog.createCategory(requireCompanyId(companyId), body);
  }

  @Post('catalog/sections')
  @RequirePermission('ORDERS_V3_WRITE')
  createSection(@CompanyId() companyId: string, @Body() body: OrdersV3NamedInput) {
    return this.catalog.createSection(requireCompanyId(companyId), body);
  }

  @Post('catalog/locations')
  @RequirePermission('ORDERS_V3_WRITE')
  createLocation(
    @CompanyId() companyId: string,
    @Body() body: OrdersV3NamedInput & { kind?: string; sectionId?: string | null },
  ) {
    return this.catalog.createLocation(requireCompanyId(companyId), body);
  }

  @Post('catalog/items')
  @RequirePermission('ORDERS_V3_WRITE')
  createItem(@CompanyId() companyId: string, @Body() body: OrdersV3ItemInput) {
    return this.catalog.createItem(requireCompanyId(companyId), body);
  }

  @Post('catalog/conversions/publish')
  @RequirePermission('ORDERS_V3_WRITE')
  publishConversion(@CompanyId() companyId: string, @Body() body: OrdersV3ConversionPublishInput) {
    return this.catalog.publishConversion(requireCompanyId(companyId), body);
  }

  @Post('catalog/recipes/publish')
  @RequirePermission('ORDERS_V3_WRITE')
  publishRecipe(@CompanyId() companyId: string, @Body() body: OrdersV3RecipePublishInput) {
    return this.catalog.publishRecipe(requireCompanyId(companyId), body);
  }

  @Delete('catalog/:entity/:id')
  @RequirePermission('ORDERS_V3_DELETE')
  deactivate(
    @CompanyId() companyId: string,
    @Param('entity') entity: 'unit' | 'category' | 'section' | 'item' | 'location',
    @Param('id') id: string,
  ) {
    return this.catalog.deactivate(requireCompanyId(companyId), entity, id);
  }

  @Get('documents')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_WRITE', 'ORDERS_V3_STAFF_SUBMIT', 'ORDERS_V3_INTERNAL_SUBMIT')
  listDocuments(
    @CompanyId() companyId: string,
    @Query('type') type?: OrdersV3DocumentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    if (!user) throw new ForbiddenException('غير مصادق');
    const canReadAll = userCan(user, PERMISSIONS.ORDERS_V3_READ) || userCan(user, PERMISSIONS.ORDERS_V3_WRITE);
    if (!canReadAll && (!type || !userCan(user, submitPermission(type)))) {
      throw new ForbiddenException('لا تملك صلاحية قراءة هذا النوع من مستندات V3');
    }
    return this.documents.list(requireCompanyId(companyId), type, startDate, endDate, canReadAll ? undefined : user.sub);
  }

  @Post('documents')
  @RequireAnyPermission('ORDERS_V3_WRITE', 'ORDERS_V3_STAFF_SUBMIT', 'ORDERS_V3_INTERNAL_SUBMIT')
  createDocument(@CompanyId() companyId: string, @Body() body: OrdersV3DocumentInput, @CurrentUser() user: JwtUser) {
    if (!userCan(user, PERMISSIONS.ORDERS_V3_WRITE) && !userCan(user, submitPermission(body.documentType))) {
      throw new ForbiddenException('لا تملك صلاحية إنشاء هذا النوع من مستندات V3');
    }
    return this.documents.create(requireCompanyId(companyId), body);
  }

  @Post('documents/:id/reverse')
  @RequirePermission('ORDERS_V3_DELETE')
  reverseDocument(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: { idempotencyKey?: string },
  ) {
    return this.documents.reverse(requireCompanyId(companyId), id, body.idempotencyKey || '');
  }

  @Get('reports/summary')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ')
  summary(@CompanyId() companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reports.summary(requireCompanyId(companyId), startDate, endDate);
  }

  @Get('reports/items')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ')
  itemReport(
    @CompanyId() companyId: string,
    @Query('type') type?: OrdersV3DocumentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reports.itemsReport(requireCompanyId(companyId), type, startDate, endDate);
  }

  @Get('reports/sales')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ')
  salesReport(@CompanyId() companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reports.salesReport(requireCompanyId(companyId), startDate, endDate);
  }

  @Get('inventory/balances')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ', 'ORDERS_V3_INVENTORY_WRITE')
  balances(@CompanyId() companyId: string) {
    return this.inventory.balances(requireCompanyId(companyId));
  }

  @Get('inventory/ledger')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ', 'ORDERS_V3_INVENTORY_WRITE')
  ledger(
    @CompanyId() companyId: string,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.inventory.ledger(requireCompanyId(companyId), itemId, locationId);
  }

  @Get('inventory/stocktakes')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_INVENTORY_WRITE')
  stocktakes(@CompanyId() companyId: string) {
    return this.inventory.listStocktakes(requireCompanyId(companyId));
  }

  @Post('inventory/stocktakes')
  @RequirePermission('ORDERS_V3_INVENTORY_WRITE')
  createStocktake(@CompanyId() companyId: string, @Body() body: OrdersV3StocktakeInput) {
    return this.inventory.createStocktake(requireCompanyId(companyId), body);
  }

  @Get('inventory/data-quality')
  @RequireAnyPermission('ORDERS_V3_READ', 'ORDERS_V3_REPORTS_READ', 'ORDERS_V3_INVENTORY_WRITE')
  dataQuality(@CompanyId() companyId: string) {
    return this.inventory.dataQuality(requireCompanyId(companyId));
  }
}
