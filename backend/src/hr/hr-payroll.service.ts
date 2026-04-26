/**
 * HrPayrollService — واجهة واحدة: مسيرات (قراءة/دورة/صرف) + سلف/حركات/بدلات/خصومات
 * التنفيذ مُقسّم عبر HrPayrollRunReaderService و HrPayrollRunLifecycleService
 * و HrPayrollRunIssueService و HrPayrollAncillaryService.
 */
import { Injectable } from '@nestjs/common';
import { HrPayrollAncillaryService } from './hr-payroll-ancillary.service';
import { HrPayrollRunReaderService } from './hr-payroll-run-reader.service';
import { HrPayrollRunLifecycleService } from './hr-payroll-run-lifecycle.service';
import { HrPayrollRunIssueService } from './hr-payroll-run-issue.service';

@Injectable()
export class HrPayrollService {
  constructor(
    private readonly reader: HrPayrollRunReaderService,
    private readonly runLifecycle: HrPayrollRunLifecycleService,
    private readonly runIssue: HrPayrollRunIssueService,
    private readonly ancillary: HrPayrollAncillaryService,
  ) {}

  findPayrollRuns(...args: Parameters<HrPayrollRunReaderService['findPayrollRuns']>) {
    return this.reader.findPayrollRuns(...args);
  }

  findPayrollRunItemsByEmployee(
    ...args: Parameters<HrPayrollRunReaderService['findPayrollRunItemsByEmployee']>
  ) {
    return this.reader.findPayrollRunItemsByEmployee(...args);
  }

  findPayrollRunById(...args: Parameters<HrPayrollRunReaderService['findPayrollRunById']>) {
    return this.reader.findPayrollRunById(...args);
  }

  createPayrollRun(...args: Parameters<HrPayrollRunLifecycleService['createPayrollRun']>) {
    return this.runLifecycle.createPayrollRun(...args);
  }

  updatePayrollRunStatus(
    ...args: Parameters<HrPayrollRunLifecycleService['updatePayrollRunStatus']>
  ) {
    return this.runLifecycle.updatePayrollRunStatus(...args);
  }

  updatePayrollRun(...args: Parameters<HrPayrollRunLifecycleService['updatePayrollRun']>) {
    return this.runLifecycle.updatePayrollRun(...args);
  }

  deletePayrollRun(...args: Parameters<HrPayrollRunLifecycleService['deletePayrollRun']>) {
    return this.runLifecycle.deletePayrollRun(...args);
  }

  issuePayrollPayment(...args: Parameters<HrPayrollRunIssueService['issuePayrollPayment']>) {
    return this.runIssue.issuePayrollPayment(...args);
  }

  findAdvanceInvoices(...args: Parameters<HrPayrollAncillaryService['findAdvanceInvoices']>) {
    return this.ancillary.findAdvanceInvoices(...args);
  }

  findMovements(...args: Parameters<HrPayrollAncillaryService['findMovements']>) {
    return this.ancillary.findMovements(...args);
  }

  createMovement(...args: Parameters<HrPayrollAncillaryService['createMovement']>) {
    return this.ancillary.createMovement(...args);
  }

  findAllowances(...args: Parameters<HrPayrollAncillaryService['findAllowances']>) {
    return this.ancillary.findAllowances(...args);
  }

  createAllowance(...args: Parameters<HrPayrollAncillaryService['createAllowance']>) {
    return this.ancillary.createAllowance(...args);
  }

  deleteAllowance(...args: Parameters<HrPayrollAncillaryService['deleteAllowance']>) {
    return this.ancillary.deleteAllowance(...args);
  }

  findDeductions(...args: Parameters<HrPayrollAncillaryService['findDeductions']>) {
    return this.ancillary.findDeductions(...args);
  }

  createDeduction(...args: Parameters<HrPayrollAncillaryService['createDeduction']>) {
    return this.ancillary.createDeduction(...args);
  }
}
