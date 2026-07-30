import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { requireCompanyId } from '../common/utils/require-company-id';
import {
  CreateShishaPurchaseBatchDto,
  CreateShishaPurchaseDto,
  CreateShishaStocktakeDto,
  InitializeShishaInventoryDto,
} from './dto/shisha-inventory.dto';
import {
  type CurrentAuthUser,
  parseRequiredDateRange,
  requireCurrentUserId,
} from './orders-controller-query.util';
import { ShishaInventoryService } from './shisha-inventory.service';

@Controller('orders')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class ShishaInventoryController {
  constructor(private readonly shishaInventoryService: ShishaInventoryService) {}

  @Get('shisha-inventory/summary')
  @RequireAnyPermission('ORDERS_READ', 'ORDERS_WRITE')
  getShishaInventorySummary(
    @CompanyId() companyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const range = parseRequiredDateRange(startDate, endDate);
    return this.shishaInventoryService.getSummary(requireCompanyId(companyId), range.startDate, range.endDate);
  }

  @Post('shisha-inventory/purchases/batch')
  @RequirePermission('ORDERS_WRITE')
  createShishaInventoryPurchases(
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: CreateShishaPurchaseBatchDto,
  ) {
    return this.shishaInventoryService.recordPurchases(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      body,
    );
  }

  @Post('shisha-inventory/initialize')
  @RequirePermission('ORDERS_WRITE')
  initializeShishaInventory(
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: InitializeShishaInventoryDto,
  ) {
    return this.shishaInventoryService.initialize(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      body,
    );
  }

  @Post('shisha-inventory/purchases')
  @RequirePermission('ORDERS_WRITE')
  createShishaInventoryPurchase(
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: CreateShishaPurchaseDto,
  ) {
    return this.shishaInventoryService.recordPurchase(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      body,
    );
  }

  @Post('shisha-inventory/stocktakes')
  @RequirePermission('ORDERS_WRITE')
  createShishaInventoryStocktake(
    @CompanyId() companyId: string,
    @CurrentUser() user: CurrentAuthUser,
    @Body() body: CreateShishaStocktakeDto,
  ) {
    return this.shishaInventoryService.createStocktake(
      requireCompanyId(companyId),
      requireCurrentUserId(user),
      body,
    );
  }
}
