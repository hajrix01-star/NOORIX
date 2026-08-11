import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ensureUploadsSubdir } from '../common/uploads-root';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialCoreModule } from '../financial-core/financial-core.module';
import { AccountingCoreModule } from '../accounting-core/accounting-core.module';
import { FiscalPeriodModule } from '../fiscal-period/fiscal-period.module';
import { EmployeesModule } from '../employees/employees.module';
import { SupplierDirectoryModule } from '../supplier-directory/supplier-directory.module';
import { HRController } from './hr.controller';
import { HrSupportController } from './hr-support.controller';
import { HRService } from './hr.service';
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { HrPayrollRunLifecycleService } from './hr-payroll-run-lifecycle.service';
import { HrPayrollRunIssueService } from './hr-payroll-run-issue.service';
import { HrPayrollIndividualPaymentService } from './hr-payroll-individual-payment.service';
import { HrPayrollAncillaryService } from './hr-payroll-ancillary.service';
import { HrPayrollManualEntryService } from './hr-payroll-manual-entry.service';
import { HrLeaveService } from './hr-leave.service';
import { HrResidencyService } from './hr-residency.service';
import { HrDocumentService } from './hr-document.service';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';
import { HrPayrollReconciliationService } from './hr-payroll-reconciliation.service';
import { HrPayrollLegacyCorrectionService } from './hr-payroll-legacy-correction.service';
import { HrHistoricalPartTimePayrollService } from './hr-historical-part-time-payroll.service';

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
    FiscalPeriodModule,
    EmployeesModule,
    SupplierDirectoryModule,
  ],
  controllers: [HRController, HrSupportController],
  providers: [
    HrPayrollRunReaderService,
    HrPayrollRunLifecycleService,
    HrPayrollRunIssueService,
    HrPayrollIndividualPaymentService,
    HrPayrollManualEntryService,
    HrPayrollAncillaryService,
    HrPayrollService,
    HrLeaveService,
    HrResidencyService,
    HrDocumentService,
    HrCompensationSnapshotService,
    HrPayrollReconciliationService,
    HrPayrollLegacyCorrectionService,
    HrHistoricalPartTimePayrollService,
    HRService,
  ],
  exports: [HRService],
})
export class HRModule {}
