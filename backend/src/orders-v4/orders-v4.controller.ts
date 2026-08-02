import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { hasPermission, PERMISSIONS, type Permission } from '../auth/constants/permissions';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { requireCompanyId } from '../common/utils/require-company-id';
import { OrdersV4CatalogService } from './orders-v4-catalog.service';
import type {
  OrdersV4DocumentInput,
  OrdersV4DocumentType,
  OrdersV4ItemInput,
  OrdersV4ItemDefinitionInput,
  OrdersV4ItemUpdateInput,
  OrdersV4NamedInput,
  OrdersV4RecipePublishInput,
  OrdersV4ReceiveInput,
  OrdersV4StocktakeInput,
  OrdersV4UnitInput,
} from './orders-v4.contracts';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { OrdersV4InventoryService } from './orders-v4-inventory.service';
import { OrdersV4ItemDefinitionService } from './orders-v4-item-definition.service';
import { OrdersV4LegacyCutoverService } from './orders-v4-legacy-cutover.service';
import { OrdersV4LegacyCutoverImportService } from './orders-v4-legacy-cutover-import.service';
import { OrdersV4ReportsService } from './orders-v4-reports.service';

function userCan(user: JwtUser, permission: Permission): boolean {
  return hasPermission(user.role, permission, user.permissions);
}

function submitPermission(documentType: OrdersV4DocumentType): Permission {
  return documentType === 'purchase'
    ? PERMISSIONS.ORDERS_V4_STAFF_SUBMIT
    : PERMISSIONS.ORDERS_V4_INTERNAL_SUBMIT;
}

@Controller('orders-v4')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class OrdersV4Controller {
  constructor(
    private readonly catalog: OrdersV4CatalogService,
    private readonly documents: OrdersV4DocumentsService,
    private readonly inventory: OrdersV4InventoryService,
    private readonly itemDefinitions: OrdersV4ItemDefinitionService,
    private readonly legacyCutover: OrdersV4LegacyCutoverService,
    private readonly legacyCutoverImport: OrdersV4LegacyCutoverImportService,
    private readonly reports: OrdersV4ReportsService,
  ) {}

  @Get('bootstrap')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_WRITE', 'ORDERS_V4_STAFF_SUBMIT', 'ORDERS_V4_INTERNAL_SUBMIT', 'ORDERS_V4_REPORTS_READ', 'ORDERS_V4_INVENTORY_WRITE')
  bootstrap(@CompanyId() companyId: string, @CurrentUser() user: JwtUser) {
    const hasBroaderAccess = [
      PERMISSIONS.ORDERS_V4_READ,
      PERMISSIONS.ORDERS_V4_WRITE,
      PERMISSIONS.ORDERS_V4_STAFF_SUBMIT,
      PERMISSIONS.ORDERS_V4_REPORTS_READ,
      PERMISSIONS.ORDERS_V4_INVENTORY_WRITE,
    ].some((permission) => userCan(user, permission));
    return hasBroaderAccess
      ? this.catalog.getBootstrap(requireCompanyId(companyId))
      : this.catalog.getInternalRegistrationBootstrap(requireCompanyId(companyId));
  }

  @Post('catalog/units')
  @RequirePermission('ORDERS_V4_WRITE')
  createUnit(@CompanyId() companyId: string, @Body() body: OrdersV4UnitInput) {
    return this.catalog.createUnit(requireCompanyId(companyId), body);
  }

  @Post('catalog/categories')
  @RequirePermission('ORDERS_V4_WRITE')
  createCategory(@CompanyId() companyId: string, @Body() body: OrdersV4NamedInput) {
    return this.catalog.createCategory(requireCompanyId(companyId), body);
  }

  @Post('catalog/sections')
  @RequirePermission('ORDERS_V4_WRITE')
  createSection(@CompanyId() companyId: string, @Body() body: OrdersV4NamedInput) {
    return this.catalog.createSection(requireCompanyId(companyId), body);
  }

  @Post('catalog/locations')
  @RequirePermission('ORDERS_V4_WRITE')
  createLocation(
    @CompanyId() companyId: string,
    @Body() body: OrdersV4NamedInput & { kind?: string; sectionId?: string | null },
  ) {
    return this.catalog.createLocation(requireCompanyId(companyId), body);
  }

  @Post('catalog/items')
  @RequirePermission('ORDERS_V4_WRITE')
  createItem(@CompanyId() companyId: string, @Body() body: OrdersV4ItemInput) {
    return this.catalog.createItem(requireCompanyId(companyId), body);
  }

  @Patch('catalog/items/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateItem(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4ItemUpdateInput) {
    return this.catalog.updateItem(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/categories/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateCategory(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4NamedInput) {
    return this.catalog.updateCategory(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/sections/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateSection(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4NamedInput) {
    return this.catalog.updateSection(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/items/:id/definition')
  @RequirePermission('ORDERS_V4_WRITE')
  saveItemDefinition(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: OrdersV4ItemDefinitionInput,
  ) {
    return this.itemDefinitions.save(requireCompanyId(companyId), id, body);
  }

  @Post('catalog/recipes/publish')
  @RequirePermission('ORDERS_V4_WRITE')
  publishRecipe(@CompanyId() companyId: string, @Body() body: OrdersV4RecipePublishInput) {
    return this.catalog.publishRecipe(requireCompanyId(companyId), body);
  }

  @Delete('catalog/:entity/:id')
  @RequirePermission('ORDERS_V4_DELETE')
  deactivate(
    @CompanyId() companyId: string,
    @Param('entity') entity: 'unit' | 'category' | 'section' | 'item' | 'location',
    @Param('id') id: string,
  ) {
    return this.catalog.deactivate(requireCompanyId(companyId), entity, id);
  }

  @Patch('catalog/units/:id/restore')
  @RequirePermission('ORDERS_V4_DELETE')
  restoreUnit(
    @CompanyId() companyId: string,
    @Param('id') id: string,
  ) {
    return this.catalog.restoreUnit(requireCompanyId(companyId), id);
  }

  @Get('documents')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_WRITE', 'ORDERS_V4_STAFF_SUBMIT', 'ORDERS_V4_INTERNAL_SUBMIT')
  listDocuments(
    @CompanyId() companyId: string,
    @Query('type') type?: OrdersV4DocumentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: JwtUser,
  ) {
    if (!user) throw new ForbiddenException('غير مصادق');
    const canReadAll = userCan(user, PERMISSIONS.ORDERS_V4_READ) || userCan(user, PERMISSIONS.ORDERS_V4_WRITE);
    if (!canReadAll && (!type || !userCan(user, submitPermission(type)))) {
      throw new ForbiddenException('لا تملك صلاحية قراءة هذا النوع من مستندات V4');
    }
    return this.documents.list(requireCompanyId(companyId), type, startDate, endDate, canReadAll ? undefined : user.sub);
  }

  @Post('documents')
  @RequireAnyPermission('ORDERS_V4_WRITE', 'ORDERS_V4_STAFF_SUBMIT', 'ORDERS_V4_INTERNAL_SUBMIT')
  createDocument(@CompanyId() companyId: string, @Body() body: OrdersV4DocumentInput, @CurrentUser() user: JwtUser) {
    if (!userCan(user, PERMISSIONS.ORDERS_V4_WRITE) && !userCan(user, submitPermission(body.documentType))) {
      throw new ForbiddenException('لا تملك صلاحية إنشاء هذا النوع من مستندات V4');
    }
    return this.documents.create(requireCompanyId(companyId), body);
  }

  @Patch('documents/:id/receive')
  @RequireAnyPermission('ORDERS_V4_WRITE', 'ORDERS_V4_CASHIER_RECEIVE')
  receiveLatest(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4ReceiveInput) {
    return this.documents.receiveLatest(requireCompanyId(companyId), id, body);
  }

  @Post('documents/:id/reverse')
  @RequirePermission('ORDERS_V4_DELETE')
  reverseDocument(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: { idempotencyKey?: string },
  ) {
    return this.documents.reverse(requireCompanyId(companyId), id, body.idempotencyKey || '');
  }

  @Get('reports/summary')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  summary(@CompanyId() companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reports.summary(requireCompanyId(companyId), startDate, endDate);
  }

  @Get('reports/items')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  itemReport(
    @CompanyId() companyId: string,
    @Query('type') type?: OrdersV4DocumentType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reports.itemsReport(requireCompanyId(companyId), type, startDate, endDate);
  }

  @Get('reports/sales')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  salesReport(@CompanyId() companyId: string, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.reports.salesReport(requireCompanyId(companyId), startDate, endDate);
  }

  @Get('inventory/balances')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ', 'ORDERS_V4_INVENTORY_WRITE')
  balances(@CompanyId() companyId: string) {
    return this.inventory.balances(requireCompanyId(companyId));
  }

  @Get('inventory/ledger')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ', 'ORDERS_V4_INVENTORY_WRITE')
  ledger(
    @CompanyId() companyId: string,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.inventory.ledger(requireCompanyId(companyId), itemId, locationId);
  }

  @Get('inventory/stocktakes')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_INVENTORY_WRITE')
  stocktakes(@CompanyId() companyId: string) {
    return this.inventory.listStocktakes(requireCompanyId(companyId));
  }

  @Post('inventory/stocktakes')
  @RequirePermission('ORDERS_V4_INVENTORY_WRITE')
  createStocktake(@CompanyId() companyId: string, @Body() body: OrdersV4StocktakeInput) {
    return this.inventory.createStocktake(requireCompanyId(companyId), body);
  }

  @Get('inventory/data-quality')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ', 'ORDERS_V4_INVENTORY_WRITE')
  dataQuality(@CompanyId() companyId: string) {
    return this.inventory.dataQuality(requireCompanyId(companyId));
  }

  @Get('cutover/audit')
  @RequirePermission('ORDERS_V4_DELETE')
  cutoverAudit(@CompanyId() companyId: string) {
    return this.legacyCutover.audit(requireCompanyId(companyId));
  }

  @Post('cutover/execute')
  @RequirePermission('ORDERS_V4_DELETE')
  cutoverExecute(
    @CompanyId() companyId: string,
    @Body() body: { confirmation?: string; sourceFingerprint?: string },
  ) {
    return this.legacyCutoverImport.execute(requireCompanyId(companyId), body);
  }
}
