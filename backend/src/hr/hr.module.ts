import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const uploadDir = join(process.cwd(), 'uploads', 'hr-documents');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { EmployeesModule } from '../employees/employees.module';
import { HRController } from './hr.controller';
import { HRService } from './hr.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { HrPayrollRunLifecycleService } from './hr-payroll-run-lifecycle.service';
import { HrPayrollRunIssueService } from './hr-payroll-run-issue.service';
import { HrPayrollAncillaryService } from './hr-payroll-ancillary.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ext = (file.originalname || '').split('.').pop() || 'bin';
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    PrismaModule,
    AuditModule,
    FinancialCoreModule,
    EmployeesModule,
  ],
  controllers: [HRController],
  providers: [
    HrPayrollRunReaderService,
    HrPayrollRunLifecycleService,
    HrPayrollRunIssueService,
    HrPayrollAncillaryService,
    HrPayrollService,
    HrLeaveService,
    HrResidencyService,
    HrDocumentService,
    HRService,
  ],
  exports: [HRService],
})
export class HRModule {}
