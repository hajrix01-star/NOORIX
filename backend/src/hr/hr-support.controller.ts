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
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator';
import { CompanyId } from '../auth/decorators/company-id.decorator';
import { HRService } from './hr.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateRaiseMovementDto } from './dto/update-raise-movement.dto';
import { CreateAllowanceDto } from './dto/create-allowance.dto';
import { CreateDeductionDto } from './dto/create-deduction.dto';
import { HrEmployeeQueryDto } from './dto/hr-query.dto';
import { normalizeHrEmployeeQuery } from './hr-query-contract.util';

@Controller('hr')
@UseGuards(AuthGuard('jwt'), CompanyAccessGuard, RolesGuard)
export class HrSupportController {
  constructor(private readonly hrService: HRService) {}

  @Get('documents')
  @RequirePermission('HR_READ')
  findDocuments(
    @CompanyId() companyId: string,
    @Query() query: HrEmployeeQueryDto,
  ) {
    const normalized = normalizeHrEmployeeQuery(companyId, query);
    return this.hrService.findDocuments(normalized.companyId, normalized.employeeId);
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
  uploadDocumentFile(
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

  @Get('movements')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findMovements(
    @CompanyId() companyId: string,
    @Query() query: HrEmployeeQueryDto,
  ) {
    const normalized = normalizeHrEmployeeQuery(companyId, query);
    return this.hrService.findMovements(normalized.companyId, normalized.employeeId);
  }

  @Post('movements')
  @RequireAnyPermission('HR_WRITE', 'CHAT_PRESET_INCREASES')
  createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createMovement(dto, user.sub);
  }

  @Patch('movements/:id/raise')
  @RequirePermission('HR_WRITE')
  updateRaiseMovement(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @Body() dto: UpdateRaiseMovementDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.updateRaiseMovement(id, companyId, dto, user.sub);
  }

  @Delete('movements/:id/raise')
  @RequirePermission('HR_WRITE')
  deleteRaiseMovement(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteRaiseMovement(id, companyId, user.sub);
  }

  @Get('allowances')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findAllowances(
    @CompanyId() companyId: string,
    @Query() query: HrEmployeeQueryDto,
  ) {
    const normalized = normalizeHrEmployeeQuery(companyId, query);
    return this.hrService.findAllowances(normalized.companyId, normalized.employeeId);
  }

  @Post('allowances')
  @RequireAnyPermission('HR_WRITE', 'CHAT_PRESET_INCREASES')
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

  @Get('deductions')
  @RequireAnyPermission('HR_READ', 'EMPLOYEES_READ')
  findDeductions(
    @CompanyId() companyId: string,
    @Query() query: HrEmployeeQueryDto,
  ) {
    const normalized = normalizeHrEmployeeQuery(companyId, query);
    return this.hrService.findDeductions(normalized.companyId, normalized.employeeId);
  }

  @Post('deductions')
  @RequireAnyPermission('HR_WRITE', 'CHAT_PRESET_DEDUCTIONS')
  createDeduction(
    @Body() dto: CreateDeductionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.createDeduction(dto, user.sub);
  }

  @Delete('deductions/:id')
  @RequirePermission('HR_DELETE')
  deleteDeduction(
    @Param('id') id: string,
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.hrService.deleteDeduction(id, companyId, user.sub);
  }

  @Get('dashboard-summary')
  @RequirePermission('HR_READ')
  getHrDashboardSummary(@CompanyId() companyId: string) {
    return this.hrService.getDashboardSummary(companyId);
  }
}
