import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }          from '@nestjs/passport';
import { ZodError }           from 'zod';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { createSupplierSchema } from './dto/create-supplier.dto';
import { updateSupplierSchema } from './dto/update-supplier.dto';
import { SuppliersService }   from './suppliers.service';

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermission('SUPPLIERS_READ')
  async findAll(
    @Query('companyId')      queryCompanyId:  string,
    @Headers('x-company-id') headerCompanyId: string,
    @Query('page')           page?:           string,
    @Query('pageSize')       pageSize?:       string,
  ) {
    const companyId = (headerCompanyId?.trim() || queryCompanyId?.trim()) || '';
    if (!companyId) return { items: [], total: 0, page: 1, pageSize: 50 };
    return this.suppliersService.findAll(
      companyId,
      page     ? parseInt(page, 10)     : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
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
    @Headers('x-company-id') headerCompanyId: string,
    @Body() body: unknown,
  ) {
    const companyId = headerCompanyId?.trim() || '';
    if (!companyId) throw new BadRequestException('معرف الشركة مطلوب');
    try {
      const dto = updateSupplierSchema.parse(body);
      return this.suppliersService.update(id, companyId, dto);
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.errors?.[0]?.message ?? 'بيانات غير صحيحة';
        throw new BadRequestException(msg);
      }
      throw e;
    }
  }

  @Delete(':id')
  @RequirePermission('SUPPLIERS_WRITE')
  async remove(
    @Param('id') id: string,
    @Headers('x-company-id') headerCompanyId: string,
  ) {
    const companyId = headerCompanyId?.trim() || '';
    if (!companyId) throw new BadRequestException('معرف الشركة مطلوب');
    return this.suppliersService.remove(id, companyId);
  }
}
