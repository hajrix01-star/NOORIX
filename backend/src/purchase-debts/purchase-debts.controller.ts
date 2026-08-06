import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { requireCompanyId } from '../common/utils/require-company-id';
import { CreatePurchaseDebtDto } from './dto/create-purchase-debt.dto';
import { CreatePurchaseDebtBatchDto } from './dto/create-purchase-debt-batch.dto';
import { PurchaseDebtQueryDto } from './dto/purchase-debt-query.dto';
import { UpdatePurchaseDebtDto } from './dto/update-purchase-debt.dto';
import { PurchaseDebtsService } from './purchase-debts.service';

@Controller('purchase-debts')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class PurchaseDebtsController {
  constructor(private readonly service: PurchaseDebtsService) {}

  @Get()
  @RequirePermission('PURCHASES_READ')
  list(@CompanyId() companyId: string, @Query() query: PurchaseDebtQueryDto) {
    return this.service.list(requireCompanyId(companyId), query);
  }

  @Post()
  @RequirePermission('PURCHASES_WRITE')
  create(
    @CompanyId() companyId: string,
    @Body() dto: CreatePurchaseDebtDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(requireCompanyId(companyId), dto, user.sub);
  }

  @Post('batch')
  @RequirePermission('PURCHASES_WRITE')
  createBatch(
    @CompanyId() companyId: string,
    @Body() dto: CreatePurchaseDebtBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.createBatch(requireCompanyId(companyId), dto, user.sub);
  }

  @Patch(':id')
  @RequirePermission('PURCHASES_WRITE')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdatePurchaseDebtDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.update(id, requireCompanyId(companyId), dto, user.sub);
  }

  @Post(':id/cancel')
  @RequirePermission('PURCHASES_WRITE')
  cancel(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.cancel(id, requireCompanyId(companyId), user.sub);
  }

  @Post(':id/restore')
  @RequirePermission('PURCHASES_WRITE')
  restore(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.restore(id, requireCompanyId(companyId), user.sub);
  }
}
