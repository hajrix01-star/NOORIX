import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { AuthGuard }          from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard }         from '../auth/guards/roles.guard';
import { RequirePermission }  from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { EmployeesService }   from './employees.service';
import { CreateEmployeeDto }  from './dto/create-employee.dto';
import { UpdateEmployeeDto }  from './dto/update-employee.dto';
import { CreateBatchEmployeesDto } from './dto/create-batch-employees.dto';
import { EmployeeListQueryDto } from './dto/employee-list-query.dto';
import { normalizeEmployeeListQuery } from './employee-list-query-contract.util';

@Controller('employees')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @RequireAnyPermission(
    'EMPLOYEES_READ',
    'HR_READ',
    'CHAT_PRESET_ADVANCES',
    'CHAT_PRESET_LEAVES',
    'CHAT_PRESET_DEDUCTIONS',
    'CHAT_PRESET_INCREASES',
    'CHAT_PRESET_ADD_EMPLOYEE',
  )
  findAll(
    @CompanyId() companyId: string,
    @Query() query: EmployeeListQueryDto,
  ) {
    const normalized = normalizeEmployeeListQuery(companyId, query);
    if (normalized.bulk) {
      return this.svc.findAllBulk(normalized.companyId, normalized.tab);
    }
    if (normalized.isPaged) {
      return this.svc.findPaged(
        normalized.companyId,
        normalized.tab,
        normalized.page ?? 1,
        normalized.pageSize,
        normalized.q,
        normalized.sortBy,
        normalized.sortDir,
      );
    }
    return this.svc.findAllLegacy(normalized.companyId, normalized.includeTerminated);
  }

  /** إجمالي الراتب الشهري من جدول الموظفين (للتقديرات / حاسبة التكاليف) — ليس من فواتير أو مسيرات */
  @Get('monthly-salary-contract-total')
  @RequireAnyPermission('EMPLOYEES_READ', 'HR_READ', 'REPORTS_READ')
  monthlySalaryContractTotal(@CompanyId() companyId: string) {
    return this.svc.sumActiveEmployeesContractSalaryMonthly(companyId);
  }

  @Get(':id')
  @RequireAnyPermission(
    'EMPLOYEES_READ',
    'HR_READ',
    'CHAT_PRESET_ADVANCES',
    'CHAT_PRESET_LEAVES',
    'CHAT_PRESET_DEDUCTIONS',
    'CHAT_PRESET_INCREASES',
    'CHAT_PRESET_ADD_EMPLOYEE',
  )
  findOne(
    @Param('id')        id: string,
    @CompanyId() companyId: string,
  ) {
    return this.svc.findOne(id, companyId);
  }

  @Get(':id/photo')
  @RequireAnyPermission('EMPLOYEES_READ', 'HR_READ')
  downloadPhoto(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Res() res: Response,
  ) {
    return this.svc.downloadPhoto(id, companyId, res);
  }

  @Post()
  @RequireAnyPermission('EMPLOYEES_WRITE', 'CHAT_PRESET_ADD_EMPLOYEE')
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
    @CompanyId() companyId: string,
    @Body()             dto: UpdateEmployeeDto,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.update(id, dto, companyId, user.sub);
  }

  @Post(':id/photo')
  @RequirePermission('EMPLOYEES_WRITE')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.updatePhoto(id, companyId, file, user.sub);
  }

  @Delete(':id/photo')
  @RequirePermission('EMPLOYEES_WRITE')
  deletePhoto(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.svc.deletePhoto(id, companyId, user.sub);
  }

  @Patch(':id/terminate')
  @RequirePermission('EMPLOYEES_WRITE')
  terminate(
    @Param('id')        id: string,
    @CompanyId() companyId: string,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.terminate(id, companyId, user.sub);
  }

  @Delete(':id')
  @RequirePermission('EMPLOYEES_DELETE')
  remove(
    @Param('id')        id: string,
    @CompanyId() companyId: string,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.removePermanently(id, companyId, user.sub);
  }
}
