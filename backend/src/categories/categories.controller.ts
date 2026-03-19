import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard }          from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { CategoriesService }  from './categories.service';

@Controller('categories')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @RequirePermission('SUPPLIERS_READ')
  findAll(@Query('companyId') companyId: string) {
    if (!companyId) return [];
    return this.categoriesService.findAll(companyId);
  }

  @Post()
  @RequirePermission('SUPPLIERS_WRITE')
  create(@Body() body: {
    companyId:     string;
    nameAr:        string;
    nameEn?:       string;
    parentId?:     string;
    type?:         string;
    icon?:         string;
    sortOrder?:    number;
    createAccount?: boolean;
  }) {
    return this.categoriesService.create(body);
  }

  @Patch(':id')
  @RequirePermission('SUPPLIERS_WRITE')
  update(
    @Param('id')        id:        string,
    @Query('companyId') companyId: string,
    @Body()             body:      {
      companyId?: string;
      nameAr?:    string;
      nameEn?:    string | null;
      type?:      string;
      parentId?:  string | null;
      icon?:      string | null;
      sortOrder?: number;
      isActive?:  boolean;
    },
  ) {
    return this.categoriesService.update(id, companyId || body.companyId || '', {
      nameAr:    body.nameAr,
      nameEn:    body.nameEn,
      type:      body.type,
      parentId:  body.parentId,
      icon:      body.icon,
      sortOrder: body.sortOrder,
      isActive:  body.isActive,
    });
  }

  @Delete(':id')
  @RequirePermission('SUPPLIERS_DELETE')
  remove(
    @Param('id')        id:        string,
    @Query('companyId') companyId: string,
  ) {
    return this.categoriesService.remove(id, companyId);
  }
}
