import { Injectable } from '@nestjs/common';
import { FinancialCoreService } from '../financial-core/financial-core.service';

type FinancialCoreAccountingDelegate = Pick<
  FinancialCoreService,
  'processOutflow' | 'processOutflowBatchInTransaction' | 'cancelOperation'
>;

type OutflowArgs = Parameters<FinancialCoreService['processOutflow']>;
type OutflowBatchInTxArgs = Parameters<FinancialCoreService['processOutflowBatchInTransaction']>;
type CancelArgs = Parameters<FinancialCoreService['cancelOperation']>;

@Injectable()
export class AccountingCoreService {
  constructor(private readonly financialCore: FinancialCoreAccountingDelegate) {}

  postHrServiceExpense(...args: OutflowArgs) {
    return this.financialCore.processOutflow(...args);
  }

  postLeaveSalarySettlement(...args: OutflowArgs) {
    return this.financialCore.processOutflow(...args);
  }

  postPayrollPaymentBatchInTransaction(...args: OutflowBatchInTxArgs) {
    return this.financialCore.processOutflowBatchInTransaction(...args);
  }

  reverseFinancialOperation(...args: CancelArgs) {
    return this.financialCore.cancelOperation(...args);
  }
}
