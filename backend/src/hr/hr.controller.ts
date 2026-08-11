/**
 * HRController — مسارات الموارد البشرية
 *
 * الصلاحيات: HR_READ, HR_WRITE, HR_DELETE
 * حذف مسيرة رواتب: أدوار المالك / المشرف العام / manager فقط (@Roles PAYROLL_RUN_DELETE_ROLES).
 * مسودة: حذف مباشر. مكتملة: إلغاء فواتير الراتب المرتبطة + عكس تسويات السلف ثم حذف السجل.
 * companyId: @CompanyId (مطابق CompanyAccessGuard)
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { hasPermission, PAYROLL_RUN_DELETE_ROLES, PERMISSIONS } from '../auth/constants/permissions';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { HRService } from './hr.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto, UpdatePayrollRunStatusDto } from './dto/update-payroll-run.dto';
import { CreateLeaveDto, UpdateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import { IssueLeaveSalarySettlementDto } from './dto/issue-leave-salary-settlement.dto';
import { CreateResidencyWithInvoiceDto } from './dto/create-residency-with-invoice.dto';
import { UpdateResidencyDto } from './dto/update-residency.dto';
import { IssueResidencyInvoiceDto } from './dto/issue-residency-invoice.dto';
import { IssuePayrollPaymentDto } from './dto/issue-payroll-payment.dto';
import { IssueIndividualSalaryPaymentDto } from './dto/issue-individual-salary-payment.dto';
import { CalculateEosDto } from './dto/calculate-eos.dto';
import {
  HrCompensationSnapshotsQueryDto,
  HrDeleteLeaveQueryDto,
  HrDeleteResidencyQueryDto,
  HrLeaveSalarySettlementsQueryDto,
  HrLeavesQueryDto,
  HrPayrollRunItemsQueryDto,
  HrPayrollReconciliationQueryDto,
  HrResidenciesQueryDto,
  HrYearQueryDto,
} from './dto/hr-query.dto';
import {
  normalizeHrLeavesQuery,
  normalizeHrResidenciesQuery,
  normalizeHrYearQuery,
  parseHrCsvIds,
} from './hr-query-contract.util';

@Controller('hr')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class HRController {
  constructor(private readonly hrService: HRService) {}

  // ══════════════════════════════════════════════════════════
  // PAYROLL RUNS
  // ══════════════════════════════════════════════════════════

  @Get('payroll-run-items')
  @RequirePermission('HR_READ')
  findPayrollRunItemsByEmployee(
    @CompanyId() companyId: string,
    @Query() query: HrPayrollRunItemsQueryDto,
  ) {
    return this.hrService.findPayrollRunItemsByEmployee(companyId, query.employeeId);
  }

  @Get('payroll-runs')
  @RequirePermission('HR_READ')
  findPayrollRuns(
    @CompanyId() companyId: string,
    @Query() query: HrYearQueryDto,
  ) {
    const normalized = normalizeHrYearQuery(companyId, query);
    return this.hrService.findPayrollRuns(normalized.companyId, normalized.year);
  }

  @Get('payroll-runs/:id')
  @RequirePermission('HR_READ')
  findPayrollRunById(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.hrService.findPayrollRunById(id, companyId);
  }

  @Post('payroll-runs')
  @RequirePermission('HR_WRITE')
  createPayrollRun(
    @Body() dto: CreatePayrollRunDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createPayrollRun(dto, user.sub);
  }

  @Patch('payroll-runs/:id/status')
  @RequirePermission('HR_WRITE')
  updatePayrollRunStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollRunStatusDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updatePayrollRunStatus(id, dto, companyId, user.sub);
  }

  @Patch('payroll-runs/:id')
  @RequirePermission('HR_WRITE')
  updatePayrollRun(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollRunDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updatePayrollRun(id, dto, companyId, user.sub);
  }

  @Delete('payroll-runs/:id')
  @Roles(...PAYROLL_RUN_DELETE_ROLES)
  deletePayrollRun(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deletePayrollRun(id, companyId, user.sub);
  }

  @Post('payroll-runs/issue-payment')
  @RequirePermission('HR_WRITE')
  issuePayrollPayment(
    @Body() dto: IssuePayrollPaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.issuePayrollPayment(dto, user.sub);
  }

  @Get('payroll/reconciliation')
  @RequirePermission('HR_READ')
  getPayrollReconciliation(
    @CompanyId() companyId: string,
    @Query() query: HrPayrollReconciliationQueryDto,
  ) {
    return this.hrService.getPayrollReconciliation(
      companyId,
      query.year ?? new Date().getFullYear(),
      query.includeRows ?? false,
    );
  }

  @Post('payroll-runs/issue-individual-payment')
  @RequirePermission('HR_WRITE')
  issueIndividualSalaryPayment(
    @Body() dto: IssueIndividualSalaryPaymentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.issueIndividualSalaryPayment(dto, user.sub);
  }

  // ══════════════════════════════════════════════════════════
  // ADVANCES (سلفيات)
  // ══════════════════════════════════════════════════════════

  @Get('advances')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findAdvances(
    @CompanyId() companyId: string,
    @Query() query: HrYearQueryDto,
  ) {
    const normalized = normalizeHrYearQuery(companyId, query);
    return this.hrService.findAdvanceInvoices(normalized.companyId, normalized.year);
  }

  @Get('employees/:employeeId/compensation-snapshot')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  getEmployeeCompensationSnapshot(
    @CompanyId() companyId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.hrService.getEmployeeCompensationSnapshot(companyId, employeeId);
  }

  @Get('compensation-snapshots')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  getCompanyCompensationSnapshots(
    @CompanyId() companyId: string,
    @Query() query: HrCompensationSnapshotsQueryDto,
  ) {
    return this.hrService.getCompanyCompensationSnapshots(companyId, parseHrCsvIds(query.employeeIds));
  }

  @Post('eos/calculate')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  calculateEos(@Body() dto: CalculateEosDto) {
    return this.hrService.calculateEos(dto);
  }

  // ══════════════════════════════════════════════════════════
  // LEAVES
  // ══════════════════════════════════════════════════════════

  @Get('leaves')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findLeaves(
    @CompanyId() companyId: string,
    @Query() query: HrLeavesQueryDto,
  ) {
    const normalized = normalizeHrLeavesQuery(companyId, query);
    return this.hrService.findLeaves(normalized.companyId, normalized.employeeId, normalized.year);
  }

  @Post('leaves')
  @RequireAnyPermission('HR_WRITE', 'CHAT_PRESET_LEAVES')
  createLeave(@Body() dto: CreateLeaveDto, @CurrentUser() user: JwtUser) {
    return this.hrService.createLeave(dto, user.sub);
  }

  @Patch('leaves/:id')
  @RequirePermission('HR_WRITE')
  updateLeave(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updateLeave(id, dto, companyId, user.sub);
  }

  @Patch('leaves/:id/status')
  @RequirePermission('HR_WRITE')
  updateLeaveStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveStatusDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updateLeaveStatus(id, dto, companyId, user.sub);
  }

  @Post('leaves/:id/return')
  @RequirePermission('HR_WRITE')
  returnFromLeave(
    @Param('id') id: string,
    @Body() dto: ReturnFromLeaveDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.returnFromLeave(id, dto, companyId, user.sub);
  }

  @Get('leaves/:id/salary-settlement-preview')
  @RequirePermission('HR_READ')
  getLeaveSalarySettlementPreview(
    @Param('id') id: string,
    @CompanyId() companyId: string,
  ) {
    return this.hrService.getLeaveSalarySettlementPreview(id, companyId);
  }

  @Post('leaves/:id/salary-settlement')
  @RequirePermission('HR_WRITE')
  issueLeaveSalarySettlement(
    @Param('id') id: string,
    @Body() dto: IssueLeaveSalarySettlementDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (
      dto.grossAmount != null &&
      !hasPermission(user.role, PERMISSIONS.HR_LEAVE_SALARY_OVERRIDE, user.permissions)
    ) {
      throw new ForbiddenException('تحتاج صلاحية تعديل مبلغ تسوية راتب الإجازة.');
    }
    return this.hrService.issueLeaveSalarySettlement(id, companyId, dto, user.sub);
  }

  @Delete('leaves/:id')
  @RequirePermission('HR_WRITE')
  deleteLeave(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Query() query: HrDeleteLeaveQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteLeave(
      id,
      companyId,
      user.sub,
      query.voidSettlement === true,
    );
  }

  @Get('leave-salary-settlements')
  @RequirePermission('HR_READ')
  findLeaveSalarySettlements(
    @CompanyId() companyId: string,
    @Query() query: HrLeaveSalarySettlementsQueryDto,
  ) {
    return this.hrService.findLeaveSalarySettlements(companyId, query.payrollMonth);
  }

  // ══════════════════════════════════════════════════════════
  // RESIDENCIES
  // ══════════════════════════════════════════════════════════

  @Get('residencies')
  @RequirePermission('HR_READ')
  findResidencies(
    @CompanyId() companyId: string,
    @Query() query: HrResidenciesQueryDto,
  ) {
    const normalized = normalizeHrResidenciesQuery(companyId, query);
    return this.hrService.findResidencies(normalized.companyId, normalized.employeeId, normalized.serviceCategory);
  }

  @Post('residencies')
  @RequirePermission('HR_WRITE')
  createResidency(
    @Body() dto: CreateResidencyWithInvoiceDto,
    @CurrentUser() user: JwtUser,
  ) {
    const { issueInvoice, ...createDto } = dto;
    return this.hrService.createResidency(createDto, user.sub, issueInvoice);
  }

  @Post('residencies/:id/issue-invoice')
  @RequirePermission('HR_WRITE')
  issueResidencyInvoice(
    @Param('id') id: string,
    @Body() dto: IssueResidencyInvoiceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.issueResidencyInvoice(id, dto, user.sub);
  }

  @Patch('residencies/:id')
  @RequirePermission('HR_WRITE')
  updateResidency(
    @Param('id') id: string,
    @Body() dto: UpdateResidencyDto,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updateResidency(id, dto, companyId, user.sub);
  }

  @Delete('residencies/:id')
  @RequirePermission('HR_DELETE')
  deleteResidency(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Query() query: HrDeleteResidencyQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteResidency(
      id,
      companyId,
      user.sub,
      query.voidInvoice === true,
    );
  }

  // ══════════════════════════════════════════════════════════
}
