import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ParseBoolPipe } from '@nestjs/common';
import { AuthGuard }          from '@nestjs/passport';
import { ZodError }           from 'zod';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CompanyId }         from '../auth/decorators/company-id.decorator';
import { requireCompanyId } from '../common/utils/require-company-id';
import { createSupplierSchema } from './dto/create-supplier.dto';
import { updateSupplierSchema } from './dto/update-supplier.dto';
import { SuppliersService }   from './suppliers.service';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequireAnyPermission('SUPPLIERS_READ', 'VIEW_INVOICES', 'INVOICES_READ')
  async findAll(
    @CompanyId() companyId: string,
    @Query('page')     page?:     string,
    @Query('pageSize') pageSize?: string,
    @Query('q')        q?:        string,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    return this.suppliersService.findAll(
      resolvedCompanyId,
      page     ? parseInt(page, 10)     : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
      q,
    );
  }

  @Post()
  @RequirePermission('SUPPLIERS_WRITE')
  async create(@Body() body: unknown) {
    try {
      const dto = createSupplierSchema.parse(body);
      return this.suppliersService.create(dto);
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.errors?.[0]?.message ?? 'بيانات غير صحيحة';
        throw new BadRequestException(msg);
      }
      throw e;
    }
  }

  @Patch(':id')
  @RequirePermission('SUPPLIERS_WRITE')
  async update(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() body: unknown,
  ) {
    const resolvedCompanyId = requireCompanyId(companyId);
    try {
      const dto = updateSupplierSchema.parse(body);
      return this.suppliersService.update(id, resolvedCompanyId, dto);
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.errors?.[0]?.message ?? 'بيانات غير صحيحة';
        throw new BadRequestException(msg);
      }
      throw e;
    }
  }

  @Patch(':id/bookmark')
  @RequireAnyPermission('SUPPLIERS_READ', 'SUPPLIERS_WRITE', 'VIEW_INVOICES', 'INVOICES_READ')
  async setBookmark(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body('isBookmarked', ParseBoolPipe) isBookmarked: boolean,
  ) {
    return this.suppliersService.setBookmark(id, requireCompanyId(companyId), isBookmarked);
  }

  @Delete(':id')
  @RequirePermission('SUPPLIERS_WRITE')
  async remove(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.suppliersService.remove(id, requireCompanyId(companyId));
  }
}
