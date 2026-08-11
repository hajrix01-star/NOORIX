import { Inject, Injectable } from '@nestjs/common';
import { FinancialCoreService } from '../financial-core/financial-core.service';

type FinancialCoreAccountingDelegate = Pick<
  FinancialCoreService,
  | 'processOutflow'
  | 'processOutflowWithReportingClass'
  | 'processOutflowBatchInTransaction'
  | 'processPayrollPaymentBatchInTransaction'
  | 'postPayrollAccrualLedgerInTransaction'
  | 'cancelPayrollAccrualLedgerInTransaction'
  | 'cancelProvenPayrollLegacyLedgerRowsInTransaction'
  | 'cancelOperation'
>;

type OutflowArgs = Parameters<FinancialCoreService['processOutflow']>;
type OutflowBatchInTxArgs = Parameters<FinancialCoreService['processOutflowBatchInTransaction']>;
type PayrollPaymentBatchInTxArgs = Parameters<FinancialCoreService['processPayrollPaymentBatchInTransaction']>;
type PayrollAccrualLedgerArgs = Parameters<FinancialCoreService['postPayrollAccrualLedgerInTransaction']>;
type CancelPayrollAccrualLedgerArgs = Parameters<FinancialCoreService['cancelPayrollAccrualLedgerInTransaction']>;
type CancelProvenPayrollLegacyLedgerRowsArgs = Parameters<FinancialCoreService['cancelProvenPayrollLegacyLedgerRowsInTransaction']>;
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

  postOutflowBatchInTransaction(...args: OutflowBatchInTxArgs) {
    return this.financialCore.processOutflowBatchInTransaction(...args);
  }

  postPayrollPaymentBatchInTransaction(...args: PayrollPaymentBatchInTxArgs) {
    return this.financialCore.processPayrollPaymentBatchInTransaction(...args);
  }

  postPayrollAccrualLedgerInTransaction(...args: PayrollAccrualLedgerArgs) {
    return this.financialCore.postPayrollAccrualLedgerInTransaction(...args);
  }

  cancelPayrollAccrualLedgerInTransaction(...args: CancelPayrollAccrualLedgerArgs) {
    return this.financialCore.cancelPayrollAccrualLedgerInTransaction(...args);
  }

  cancelProvenPayrollLegacyLedgerRowsInTransaction(...args: CancelProvenPayrollLegacyLedgerRowsArgs) {
    return this.financialCore.cancelProvenPayrollLegacyLedgerRowsInTransaction(...args);
  }

  reverseFinancialOperation(...args: CancelArgs) {
    return this.financialCore.cancelOperation(...args);
  }
}
