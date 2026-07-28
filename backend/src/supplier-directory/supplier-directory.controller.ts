import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { requireCompanyId } from '../common/utils/require-company-id';
import { SupplierDirectoryService } from './supplier-directory.service';

@Controller('supplier-directory')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class SupplierDirectoryController {
  constructor(private readonly directory: SupplierDirectoryService) {}

  @Get()
  @RequireAnyPermission('SUPPLIERS_READ', 'SUPPLIERS_WRITE', 'VIEW_INVOICES', 'INVOICES_READ')
  list(
    @CompanyId() companyId: string,
    @Query('q') query?: string,
  ) {
    return this.directory.list(requireCompanyId(companyId), query?.trim() || undefined);
  }

  @Post(':code/add')
  @RequirePermission('SUPPLIERS_WRITE')
  add(
    @CompanyId() companyId: string,
    @Param('code') code: string,
  ) {
    return this.directory.addToCompany(requireCompanyId(companyId), code);
  }
}
