import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ensureUploadsSubdir } from '../common/uploads-root';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { EmployeesModule } from '../employees/employees.module';
import { SupplierDirectoryModule } from '../supplier-directory/supplier-directory.module';
import { HRController } from './hr.controller';
import { HRService } from './hr.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { HrPayrollRunLifecycleService } from './hr-payroll-run-lifecycle.service';
import { HrPayrollRunIssueService } from './hr-payroll-run-issue.service';
import { HrPayrollAncillaryService } from './hr-payroll-ancillary.service';
import { HrPayrollManualEntryService } from './hr-payroll-manual-entry.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';

const uploadDir = ensureUploadsSubdir('hr-documents');

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
    AccountingCoreModule,
    EmployeesModule,
    SupplierDirectoryModule,
  ],
  controllers: [HRController],
  providers: [
    HrPayrollRunReaderService,
    HrPayrollRunLifecycleService,
    HrPayrollRunIssueService,
    HrPayrollManualEntryService,
    HrPayrollAncillaryService,
    HrPayrollService,
    HrLeaveService,
    HrResidencyService,
    HrDocumentService,
    HrCompensationSnapshotService,
    HRService,
  ],
  exports: [HRService],
})
export class HRModule {}
