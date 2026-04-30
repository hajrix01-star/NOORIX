import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
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

function parseEmployeeTab(s?: string): 'active' | 'terminated' | 'archived' {
  if (s === 'terminated' || s === 'archived') return s;
  return 'active';
}

@Controller('employees')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @RequireAnyPermission('EMPLOYEES_READ', 'HR_READ', 'CHAT_PRESET_ADVANCES', 'CHAT_PRESET_LEAVES', 'CHAT_PRESET_DEDUCTIONS', 'CHAT_PRESET_INCREASES')
  findAll(
    @CompanyId() companyId: string,
    @Query('includeTerminated')  inc?: string,
    @Query('page')               pageStr?: string,
    @Query('pageSize')           pageSizeStr?: string,
    @Query('tab')                tabStr?: string,
    @Query('q')                  q?: string,
    @Query('sortBy')             sortBy?: string,
    @Query('sortDir')            sortDir?: string,
    @Query('bulk')               bulkStr?: string,
  ) {
    if (bulkStr === '1' || bulkStr === 'true') {
      const tab = parseEmployeeTab(tabStr);
      return this.svc.findAllBulk(companyId, tab);
    }
    if (pageStr !== undefined && pageStr !== '') {
      const tab = parseEmployeeTab(tabStr);
      const page = Math.max(1, parseInt(pageStr, 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(pageSizeStr || '50', 10) || 50));
      return this.svc.findPaged(companyId, tab, page, pageSize, q, sortBy, sortDir);
    }
    return this.svc.findAllLegacy(companyId, inc === 'true');
  }

  /** إجمالي الراتب الشهري من جدول الموظفين (للتقديرات / حاسبة التكاليف) — ليس من فواتير أو مسيرات */
  @Get('monthly-salary-contract-total')
  @RequireAnyPermission('EMPLOYEES_READ', 'HR_READ', 'REPORTS_READ')
  monthlySalaryContractTotal(@CompanyId() companyId: string) {
    return this.svc.sumActiveEmployeesContractSalaryMonthly(companyId);
  }

  @Get(':id')
  @RequireAnyPermission('EMPLOYEES_READ', 'HR_READ', 'CHAT_PRESET_ADVANCES', 'CHAT_PRESET_LEAVES', 'CHAT_PRESET_DEDUCTIONS', 'CHAT_PRESET_INCREASES')
  findOne(
    @Param('id')        id: string,
    @CompanyId() companyId: string,
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
    @CompanyId() companyId: string,
    @Body()             dto: UpdateEmployeeDto,
    @CurrentUser()      user: JwtUser,
  ) {
    return this.svc.update(id, dto, companyId, user.sub);
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
