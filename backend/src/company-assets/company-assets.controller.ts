/**
 * CompanyAsset — سجل أصول الشركة (ضمان، مدة، تقرير)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { requireCompanyId } from '../common/utils/require-company-id';
import { CompanyAssetsService, WarrantyFilter } from './company-assets.service';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';
import { CompleteCompanyAssetFromInvoiceDto } from './dto/complete-from-invoice.dto';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Controller('company-assets')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class CompanyAssetsController {
  constructor(private readonly companyAssetsService: CompanyAssetsService) {}

  @Get()
  @RequireAnyPermission('ASSETS_READ', 'EXPENSES_READ')
  findAll(
    @CompanyId() companyId: string,
    @Query('warrantyFilter') warrantyFilter?: WarrantyFilter,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.companyAssetsService.findAll(requireCompanyId(companyId), {
      warrantyFilter,
      q,
      page: parsePositiveInt(page, 1),
      pageSize: parsePositiveInt(pageSize, 50),
    });
  }

  @Get('pending-invoices')
  @RequireAnyPermission('ASSETS_READ', 'EXPENSES_READ')
  findPendingWarrantyInvoices(@CompanyId() companyId: string) {
    return this.companyAssetsService.findPendingWarrantyInvoices(requireCompanyId(companyId));
  }

  @Post('complete-from-invoice')
  @RequireAnyPermission('ASSETS_WRITE', 'EXPENSES_WRITE')
  completeFromInvoice(@Body() dto: CompleteCompanyAssetFromInvoiceDto) {
    return this.companyAssetsService.completeFromInvoice(dto);
  }

  @Get(':id')
  @RequireAnyPermission('ASSETS_READ', 'EXPENSES_READ')
  findOne(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.companyAssetsService.findOne(id, requireCompanyId(companyId));
  }

  @Post()
  @RequireAnyPermission('ASSETS_WRITE', 'EXPENSES_WRITE')
  create(@Body() dto: CreateCompanyAssetDto) {
    return this.companyAssetsService.create(dto);
  }

  @Patch(':id')
  @RequireAnyPermission('ASSETS_WRITE', 'EXPENSES_WRITE')
  update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateCompanyAssetDto,
  ) {
    return this.companyAssetsService.update(id, requireCompanyId(companyId), dto);
  }

  @Delete(':id')
  @RequireAnyPermission('ASSETS_DELETE', 'EXPENSES_DELETE')
  remove(@Param('id') id: string, @CompanyId() companyId: string) {
    return this.companyAssetsService.remove(id, requireCompanyId(companyId));
  }
}
