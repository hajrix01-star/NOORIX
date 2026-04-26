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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PAYROLL_RUN_DELETE_ROLES } from '../auth/constants/permissions';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { HRService } from './hr.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto, UpdatePayrollRunStatusDto } from './dto/update-payroll-run.dto';
import { CreateLeaveDto, UpdateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { ReturnFromLeaveDto } from './dto/return-from-leave.dto';
import { IssueLeaveSalarySettlementDto } from './dto/issue-leave-salary-settlement.dto';
import { CreateResidencyDto } from './dto/create-residency.dto';
import { UpdateResidencyDto } from './dto/update-residency.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { CreateAllowanceDto } from './dto/create-allowance.dto';
import { CreateDeductionDto } from './dto/create-deduction.dto';
import { IssuePayrollPaymentDto } from './dto/issue-payroll-payment.dto';

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
    @Query('employeeId') employeeId: string,
  ) {
    return this.hrService.findPayrollRunItemsByEmployee(companyId, employeeId);
  }

  @Get('payroll-runs')
  @RequirePermission('HR_READ')
  findPayrollRuns(
    @CompanyId() companyId: string,
    @Query('year') year?: string,
  ) {
    return this.hrService.findPayrollRuns(
      companyId,
      year ? parseInt(year, 10) : undefined,
    );
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

  // ══════════════════════════════════════════════════════════
  // ADVANCES (سلفيات)
  // ══════════════════════════════════════════════════════════

  @Get('advances')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findAdvances(
    @CompanyId() companyId: string,
    @Query('year') yearStr?: string,
  ) {
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    return this.hrService.findAdvanceInvoices(companyId, Number.isFinite(year) ? year : undefined);
  }

  // ══════════════════════════════════════════════════════════
  // LEAVES
  // ══════════════════════════════════════════════════════════

  @Get('leaves')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findLeaves(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
  ) {
    return this.hrService.findLeaves(
      companyId,
      employeeId,
      year ? parseInt(year, 10) : undefined,
    );
  }

  @Post('leaves')
  @RequirePermission('HR_WRITE')
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
    return this.hrService.issueLeaveSalarySettlement(id, companyId, dto, user.sub);
  }

  @Delete('leaves/:id')
  @RequirePermission('HR_WRITE')
  deleteLeave(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Query('voidSettlement') voidSettlement: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteLeave(
      id,
      companyId,
      user.sub,
      voidSettlement === 'true',
    );
  }

  @Get('leave-salary-settlements')
  @RequirePermission('HR_READ')
  findLeaveSalarySettlements(
    @CompanyId() companyId: string,
    @Query('payrollMonth') payrollMonth: string,
  ) {
    return this.hrService.findLeaveSalarySettlements(companyId, payrollMonth);
  }

  // ══════════════════════════════════════════════════════════
  // RESIDENCIES
  // ══════════════════════════════════════════════════════════

  @Get('residencies')
  @RequirePermission('HR_READ')
  findResidencies(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.findResidencies(companyId, employeeId);
  }

  @Post('residencies')
  @RequirePermission('HR_WRITE')
  createResidency(
    @Body() dto: CreateResidencyDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createResidency(dto, user.sub);
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
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteResidency(id, companyId, user.sub);
  }

  // ══════════════════════════════════════════════════════════
  // DOCUMENTS
  // ══════════════════════════════════════════════════════════

  @Get('documents')
  @RequirePermission('HR_READ')
  findDocuments(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.findDocuments(companyId, employeeId);
  }

  @Post('documents')
  @RequirePermission('HR_WRITE')
  createDocument(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createDocument(dto, user.sub);
  }

  @Post('documents/upload')
  @RequirePermission('HR_WRITE')
  uploadDocument(
    @Body()
    body: {
      companyId: string;
      employeeId: string;
      documentType: 'contract' | 'certificate' | 'iqama' | 'other';
      fileName: string;
      filePath: string;
      fileSize: number;
    },
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.uploadDocument(
      body.companyId,
      body.employeeId,
      body.documentType,
      body.fileName,
      body.filePath,
      body.fileSize,
      user.sub,
    );
  }

  @Post('documents/upload-file')
  @RequirePermission('HR_WRITE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocumentFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId') companyId: string,
    @Body('employeeId') employeeId: string,
    @Body('documentType') documentType: 'contract' | 'certificate' | 'iqama' | 'other',
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) {
      return { success: false, error: 'لم يتم رفع أي ملف.' };
    }
    const fileName = file.originalname || file.filename || 'document';
    return this.hrService.uploadDocument(
      companyId,
      employeeId,
      documentType || 'other',
      fileName,
      file.path,
      file.size,
      user.sub,
    );
  }

  @Get('documents/:id/download')
  @RequirePermission('HR_READ')
  async downloadDocument(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Res() res: Response,
  ) {
    const doc = await this.hrService.findDocumentById(id, companyId);
    if (!doc.filePath) {
      return res.status(404).json({ message: 'الملف غير متوفر للتحميل.' });
    }
    return res.download(doc.filePath, doc.fileName);
  }

  @Delete('documents/:id')
  @RequirePermission('HR_DELETE')
  deleteDocument(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteDocument(id, companyId, user.sub);
  }

  // ══════════════════════════════════════════════════════════
  // MOVEMENTS
  // ══════════════════════════════════════════════════════════

  @Get('movements')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findMovements(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.findMovements(companyId, employeeId);
  }

  @Post('movements')
  @RequirePermission('HR_WRITE')
  createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createMovement(dto, user.sub);
  }

  // ══════════════════════════════════════════════════════════
  // ALLOWANCES
  // ══════════════════════════════════════════════════════════

  @Get('allowances')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findAllowances(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.findAllowances(companyId, employeeId);
  }

  @Post('allowances')
  @RequirePermission('HR_WRITE')
  createAllowance(
    @Body() dto: CreateAllowanceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createAllowance(dto, user.sub);
  }

  @Delete('allowances/:id')
  @RequirePermission('HR_DELETE')
  deleteAllowance(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteAllowance(id, companyId, user.sub);
  }

  // ══════════════════════════════════════════════════════════
  // DEDUCTIONS
  // ══════════════════════════════════════════════════════════

  @Get('deductions')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findDeductions(
    @CompanyId() companyId: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.hrService.findDeductions(companyId, employeeId);
  }

  @Post('deductions')
  @RequirePermission('HR_WRITE')
  createDeduction(
    @Body() dto: CreateDeductionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createDeduction(dto, user.sub);
  }
}
