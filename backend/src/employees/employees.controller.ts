import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard }          from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { EmployeesService }   from './employees.service';
import { CreateEmployeeDto }  from './dto/create-employee.dto';
import { UpdateEmployeeDto }  from './dto/update-employee.dto';
import { CreateBatchEmployeesDto } from './dto/create-batch-employees.dto';

@Controller('employees')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @RequirePermission('EMPLOYEES_READ')
  findAll(
    @Query('companyId')          companyId: string,
    @Query('includeTerminated')  inc?: string,
  ) {
    return this.svc.findAll(companyId, inc === 'true');
  }

  @Get(':id')
  @RequirePermission('EMPLOYEES_READ')
  findOne(
    @Param('id')        id: string,
    @Query('companyId') companyId: string,
  ) {
    return this.svc.findOne(id, companyId);
  }

  @Post()
  @RequirePermission('EMPLOYEES_WRITE')
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: JwtUser) {
    return this.svc.create(dto, user.sub);
  }

  @Post('batch')
  @RequirePermission('EMPLOYEES_WRITE')
  createBatch(@Body() dto: CreateBatchEmployeesDto, @CurrentUser() user: JwtUser) {
    return this.svc.createBatch(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermission('EMPLOYEES_WRITE')
  update(
    @Param('id')        id: string,
    @Query('companyId') companyId: string,
    @Body()             dto: UpdateEmployeeDto,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.update(id, dto, companyId, user.sub);
  }

  @Patch(':id/terminate')
  @RequirePermission('EMPLOYEES_WRITE')
  terminate(
    @Param('id')        id: string,
    @Query('companyId') companyId: string,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.terminate(id, companyId, user.sub);
  }
}
