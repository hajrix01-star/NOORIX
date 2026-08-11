import { Inject, Injectable } from '@nestjs/common';
import { FinancialCoreService } from '../financial-core/financial-core.service';

type FinancialCoreAccountingDelegate = Pick<
  FinancialCoreService,
  'processOutflow' | 'processOutflowWithReportingClass' | 'processPayrollPaymentBatchInTransaction' | 'cancelOperation'
>;

type OutflowArgs = Parameters<FinancialCoreService['processOutflow']>;
type PayrollPaymentBatchInTxArgs = Parameters<FinancialCoreService['processPayrollPaymentBatchInTransaction']>;
type CancelArgs = Parameters<FinancialCoreService['cancelOperation']>;

@Injectable()
export class AccountingCoreService {
  constructor(
    @Inject(FinancialCoreService)
    private readonly financialCore: FinancialCoreAccountingDelegate,
  ) {}

  postHrServiceExpense(
    dto: OutflowArgs[0],
    callerUserId?: OutflowArgs[1],
    reportingClass?: Parameters<FinancialCoreService['processOutflowWithReportingClass']>[1],
  ) {
    return reportingClass
      ? this.financialCore.processOutflowWithReportingClass(dto, reportingClass, callerUserId)
      : this.financialCore.processOutflow(dto, callerUserId);
  }

  postLeaveSalarySettlement(...args: OutflowArgs) {
    return this.financialCore.processOutflow(...args);
  }

  postPayrollPaymentBatchInTransaction(...args: PayrollPaymentBatchInTxArgs) {
    return this.financialCore.processPayrollPaymentBatchInTransaction(...args);
  }

  reverseFinancialOperation(...args: CancelArgs) {
    return this.financialCore.cancelOperation(...args);
  }
}
