import { AccountingCoreService } from './accounting-core.service';
import type { FinancialCoreService } from '../financial-core/financial-core.service';

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

type OutflowInput = Parameters<FinancialCoreService['processOutflow']>[0];
type OutflowBatchTx = Parameters<FinancialCoreService['processOutflowBatchInTransaction']>[0];
type OutflowBatchInput = Parameters<FinancialCoreService['processOutflowBatchInTransaction']>[1];
type PayrollAccrualInput = Parameters<FinancialCoreService['postPayrollAccrualLedgerInTransaction']>[1];
type CancelInput = Parameters<FinancialCoreService['cancelOperation']>[0];

describe('AccountingCoreService', () => {
  it('delegates HR accounting operations through the financial core', async () => {
    const financialCore: FinancialCoreAccountingDelegate = {
      processOutflow: jest.fn().mockResolvedValue({ invoice: { id: 'inv-1' } }),
      processOutflowWithReportingClass: jest.fn().mockResolvedValue({ invoice: { id: 'inv-hr' } }),
      processOutflowBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-standard' } }]),
      processPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-2' } }]),
      postPayrollAccrualLedgerInTransaction: jest.fn().mockResolvedValue(undefined),
      cancelPayrollAccrualLedgerInTransaction: jest.fn().mockResolvedValue({ count: 1 }),
      cancelProvenPayrollLegacyLedgerRowsInTransaction: jest.fn().mockResolvedValue({ count: 27 }),
      cancelOperation: jest.fn().mockResolvedValue({ cancelled: true }),
    };
    const service = new AccountingCoreService(financialCore);
    const tx = {} as OutflowBatchTx;

    await expect(service.postHrServiceExpense({ companyId: 'co-1' } as OutflowInput, 'u-1')).resolves.toEqual({
      invoice: { id: 'inv-1' },
    });
    await expect(service.postHrServiceExpense(
      { companyId: 'co-1' } as OutflowInput,
      'u-1',
      'operating_recurring_expense',
    )).resolves.toEqual({ invoice: { id: 'inv-hr' } });
    await expect(service.postLeaveSalarySettlement({ companyId: 'co-1' } as OutflowInput, 'u-1')).resolves.toEqual({
      invoice: { id: 'inv-1' },
    });
    await expect(
      service.postOutflowBatchInTransaction(tx, [] as OutflowBatchInput, 'u-1', 'tenant-1'),
    ).resolves.toEqual([{ invoice: { id: 'inv-standard' } }]);
    await expect(
      service.postPayrollPaymentBatchInTransaction(tx, [] as OutflowBatchInput, 'u-1', 'tenant-1'),
    ).resolves.toEqual([{ invoice: { id: 'inv-2' } }]);
    await expect(
      service.postPayrollAccrualLedgerInTransaction(tx, {} as PayrollAccrualInput),
    ).resolves.toBeUndefined();
    await expect(service.cancelPayrollAccrualLedgerInTransaction(tx, 'co-1', 'run-1'))
      .resolves.toEqual({ count: 1 });
    await expect(service.reverseFinancialOperation({ companyId: 'co-1' } as CancelInput, 'u-1')).resolves.toEqual({
      cancelled: true,
    });

    expect(financialCore.processOutflow).toHaveBeenCalledTimes(2);
    expect(financialCore.processOutflowWithReportingClass).toHaveBeenCalledWith(
      { companyId: 'co-1' }, 'operating_recurring_expense', 'u-1',
    );
    expect(financialCore.processOutflowBatchInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.processPayrollPaymentBatchInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.postPayrollAccrualLedgerInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.cancelPayrollAccrualLedgerInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.cancelOperation).toHaveBeenCalledTimes(1);
  });
});
