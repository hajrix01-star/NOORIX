/**
 * CompanyAsset — سجل أصول الشركة (ضمان، مدة، تقرير)
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyAssetsService, WarrantyFilter } from './company-assets.service';
import { CreateCompanyAssetDto } from './dto/create-company-asset.dto';
import { UpdateCompanyAssetDto } from './dto/update-company-asset.dto';
import { CompleteCompanyAssetFromInvoiceDto } from './dto/complete-from-invoice.dto';

@Controller('company-assets')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class CompanyAssetsController {
  constructor(private readonly companyAssetsService: CompanyAssetsService) {}

  @Get()
  @RequirePermission('EXPENSES_READ')
  findAll(
    @Query('companyId') companyId: string,
    @Query('warrantyFilter') warrantyFilter?: WarrantyFilter,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!companyId) return { items: [], total: 0, page: 1, pageSize: 50, sumAcquisitionCostAll: '0' };
    return this.companyAssetsService.findAll(companyId, {
      warrantyFilter,
      q,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
    });
  }

  @Get('pending-invoices')
  @RequirePermission('EXPENSES_READ')
  findPendingWarrantyInvoices(@Query('companyId') companyId: string) {
    if (!companyId) return [];
    return this.companyAssetsService.findPendingWarrantyInvoices(companyId);
  }

  @Post('complete-from-invoice')
  @RequirePermission('EXPENSES_WRITE')
  completeFromInvoice(@Body() dto: CompleteCompanyAssetFromInvoiceDto) {
    return this.companyAssetsService.completeFromInvoice(dto);
  }

  @Get(':id')
  @RequirePermission('EXPENSES_READ')
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.companyAssetsService.findOne(id, companyId);
  }

  @Post()
  @RequirePermission('EXPENSES_WRITE')
  create(@Body() dto: CreateCompanyAssetDto) {
    return this.companyAssetsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('EXPENSES_WRITE')
  update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() dto: UpdateCompanyAssetDto,
  ) {
    return this.companyAssetsService.update(id, companyId, dto);
  }

  @Delete(':id')
  @RequirePermission('EXPENSES_DELETE')
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.companyAssetsService.remove(id, companyId);
  }
}
