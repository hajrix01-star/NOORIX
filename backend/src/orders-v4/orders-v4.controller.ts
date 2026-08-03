import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { hasPermission, PERMISSIONS, type Permission } from '../auth/constants/permissions';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { requireCompanyId } from '../common/utils/require-company-id';
import { OrdersV4CatalogService } from './orders-v4-catalog.service';
import type { OrdersV4DocumentType } from './orders-v4.contracts';
import {
  OrdersV4ActivityReportQueryDto,
  OrdersV4DateRangeQueryDto,
  OrdersV4DocumentDto,
  OrdersV4DocumentPreviewDto,
  OrdersV4DocumentsQueryDto,
  OrdersV4IdempotencyDto,
  OrdersV4ItemDefinitionDto,
  OrdersV4ItemDto,
  OrdersV4ItemsReportQueryDto,
  OrdersV4ItemUpdateDto,
  OrdersV4LedgerQueryDto,
  OrdersV4LimitQueryDto,
  OrdersV4LocationDto,
  OrdersV4NamedDto,
  OrdersV4ReceiveDto,
  OrdersV4RecipePublishDto,
  OrdersV4StocktakeDto,
  OrdersV4UnitDto,
} from './orders-v4.dto';
import { OrdersV4DocumentsService } from './orders-v4-documents.service';
import { resolveOrdersV4DocumentListScope } from './orders-v4-document-access.policy';
import { OrdersV4InventoryService } from './orders-v4-inventory.service';
import { OrdersV4ItemDefinitionService } from './orders-v4-item-definition.service';
import { OrdersV4ReportsService } from './orders-v4-reports.service';
import { ordersV4ReportFiltersFromQuery } from './orders-v4-report-filters.util';

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
  createUnit(@CompanyId() companyId: string, @Body() body: OrdersV4UnitDto) {
    return this.catalog.createUnit(requireCompanyId(companyId), body);
  }

  @Post('catalog/categories')
  @RequirePermission('ORDERS_V4_WRITE')
  createCategory(@CompanyId() companyId: string, @Body() body: OrdersV4NamedDto) {
    return this.catalog.createCategory(requireCompanyId(companyId), body);
  }

  @Post('catalog/sections')
  @RequirePermission('ORDERS_V4_WRITE')
  createSection(@CompanyId() companyId: string, @Body() body: OrdersV4NamedDto) {
    return this.catalog.createSection(requireCompanyId(companyId), body);
  }

  @Post('catalog/locations')
  @RequirePermission('ORDERS_V4_WRITE')
  createLocation(
    @CompanyId() companyId: string,
    @Body() body: OrdersV4LocationDto,
  ) {
    return this.catalog.createLocation(requireCompanyId(companyId), body);
  }

  @Post('catalog/items')
  @RequirePermission('ORDERS_V4_WRITE')
  createItem(@CompanyId() companyId: string, @Body() body: OrdersV4ItemDto) {
    return this.catalog.createItem(requireCompanyId(companyId), body);
  }

  @Patch('catalog/items/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateItem(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4ItemUpdateDto) {
    return this.catalog.updateItem(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/categories/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateCategory(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4NamedDto) {
    return this.catalog.updateCategory(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/sections/:id')
  @RequirePermission('ORDERS_V4_WRITE')
  updateSection(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4NamedDto) {
    return this.catalog.updateSection(requireCompanyId(companyId), id, body);
  }

  @Patch('catalog/items/:id/definition')
  @RequirePermission('ORDERS_V4_WRITE')
  saveItemDefinition(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: OrdersV4ItemDefinitionDto,
  ) {
    return this.itemDefinitions.save(requireCompanyId(companyId), id, body);
  }

  @Post('catalog/recipes/publish')
  @RequirePermission('ORDERS_V4_WRITE')
  publishRecipe(@CompanyId() companyId: string, @Body() body: OrdersV4RecipePublishDto) {
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
    @Query() query?: OrdersV4DocumentsQueryDto,
    @CurrentUser() user?: JwtUser,
  ) {
    const { type, startDate, endDate } = query ?? {};
    if (!user) throw new ForbiddenException('غير مصادق');
    const canReadAll = userCan(user, PERMISSIONS.ORDERS_V4_READ) || userCan(user, PERMISSIONS.ORDERS_V4_WRITE);
    if (!canReadAll && (!type || !userCan(user, submitPermission(type)))) {
      throw new ForbiddenException('لا تملك صلاحية قراءة هذا النوع من مستندات V4');
    }
    const scope = resolveOrdersV4DocumentListScope({
      canReadAll,
      documentType: type,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
      userId: user.sub,
    });
    return this.documents.list(
      requireCompanyId(companyId),
      type,
      scope.startDate,
      scope.endDate,
      scope.createdByUserId,
      query?.limit,
      {
        search: query?.search,
        sectionId: query?.sectionId,
        categoryId: query?.categoryId,
        itemId: query?.itemId,
        paymentMethod: query?.paymentMethod,
        status: query?.status,
      },
    );
  }

  @Post('documents')
  @RequireAnyPermission('ORDERS_V4_WRITE', 'ORDERS_V4_STAFF_SUBMIT', 'ORDERS_V4_INTERNAL_SUBMIT')
  createDocument(@CompanyId() companyId: string, @Body() body: OrdersV4DocumentDto, @CurrentUser() user: JwtUser) {
    if (!userCan(user, PERMISSIONS.ORDERS_V4_WRITE) && !userCan(user, submitPermission(body.documentType))) {
      throw new ForbiddenException('لا تملك صلاحية إنشاء هذا النوع من مستندات V4');
    }
    return this.documents.create(requireCompanyId(companyId), body);
  }

  @Post('documents/preview')
  @RequireAnyPermission('ORDERS_V4_WRITE', 'ORDERS_V4_STAFF_SUBMIT', 'ORDERS_V4_CASHIER_RECEIVE')
  previewPurchaseDocument(
    @CompanyId() companyId: string,
    @Body() body: OrdersV4DocumentPreviewDto,
  ) {
    return this.documents.previewPurchase(requireCompanyId(companyId), body.lines);
  }

  @Patch('documents/:id/receive')
  @RequireAnyPermission('ORDERS_V4_WRITE', 'ORDERS_V4_CASHIER_RECEIVE')
  receiveLatest(@CompanyId() companyId: string, @Param('id') id: string, @Body() body: OrdersV4ReceiveDto) {
    return this.documents.receiveLatest(requireCompanyId(companyId), id, body);
  }

  @Post('documents/:id/reverse')
  @RequirePermission('ORDERS_V4_DELETE')
  reverseDocument(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: OrdersV4IdempotencyDto,
  ) {
    return this.documents.reverse(requireCompanyId(companyId), id, body.idempotencyKey);
  }

  @Post('documents/:id/undo-reverse')
  @Roles('owner')
  undoReverseDocument(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: OrdersV4IdempotencyDto,
  ) {
    return this.documents.undoReverse(requireCompanyId(companyId), id, body.idempotencyKey);
  }

  @Post('documents/:id/reopen')
  @Roles('owner')
  reopenPurchaseDocument(
    @CompanyId() companyId: string,
    @Param('id') id: string,
    @Body() body: OrdersV4IdempotencyDto,
  ) {
    return this.documents.reopenPurchase(requireCompanyId(companyId), id, body.idempotencyKey);
  }

  @Get('reports/summary')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  summary(@CompanyId() companyId: string, @Query() query?: OrdersV4DateRangeQueryDto) {
    return this.reports.summary(requireCompanyId(companyId), query?.startDate, query?.endDate);
  }

  @Get('reports/activity')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  activityReport(@CompanyId() companyId: string, @Query() query?: OrdersV4ActivityReportQueryDto) {
    return this.reports.activityReport(
      requireCompanyId(companyId),
      query?.type,
      query?.startDate,
      query?.endDate,
      ordersV4ReportFiltersFromQuery(query),
    );
  }

  @Get('reports/items')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  itemReport(
    @CompanyId() companyId: string,
    @Query() query?: OrdersV4ItemsReportQueryDto,
  ) {
    return this.reports.itemsReport(requireCompanyId(companyId), query?.type, query?.startDate, query?.endDate);
  }

  @Get('reports/sales')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ')
  salesReport(@CompanyId() companyId: string, @Query() query?: OrdersV4ActivityReportQueryDto) {
    return this.reports.salesReport(
      requireCompanyId(companyId),
      query?.startDate,
      query?.endDate,
      ordersV4ReportFiltersFromQuery(query),
    );
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
    @Query() query?: OrdersV4LedgerQueryDto,
  ) {
    return this.inventory.ledger(requireCompanyId(companyId), query?.itemId, query?.locationId, query?.limit);
  }

  @Get('inventory/stocktakes')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_INVENTORY_WRITE')
  stocktakes(@CompanyId() companyId: string, @Query() query?: OrdersV4LimitQueryDto) {
    return this.inventory.listStocktakes(requireCompanyId(companyId), query?.limit);
  }

  @Post('inventory/stocktakes')
  @RequirePermission('ORDERS_V4_INVENTORY_WRITE')
  createStocktake(@CompanyId() companyId: string, @Body() body: OrdersV4StocktakeDto) {
    return this.inventory.createStocktake(requireCompanyId(companyId), body);
  }

  @Get('inventory/data-quality')
  @RequireAnyPermission('ORDERS_V4_READ', 'ORDERS_V4_REPORTS_READ', 'ORDERS_V4_INVENTORY_WRITE')
  dataQuality(@CompanyId() companyId: string) {
    return this.inventory.dataQuality(requireCompanyId(companyId));
  }

}
