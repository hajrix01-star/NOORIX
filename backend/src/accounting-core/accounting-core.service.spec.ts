import { AccountingCoreService } from './accounting-core.service';
import type { FinancialCoreService } from '../financial-core/financial-core.service';

type FinancialCoreAccountingDelegate = Pick<
  FinancialCoreService,
  'processOutflow' | 'processOutflowWithReportingClass' | 'processPayrollPaymentBatchInTransaction' | 'cancelOperation'
>;
type OutflowInput = Parameters<FinancialCoreService['processOutflow']>[0];
type OutflowBatchDto = Parameters<FinancialCoreService['processPayrollPaymentBatchInTransaction']>[0];
type OutflowBatchInput = Parameters<FinancialCoreService['processPayrollPaymentBatchInTransaction']>[1];
type CancelInput = Parameters<FinancialCoreService['cancelOperation']>[0];

describe('AccountingCoreService', () => {
  it('delegates HR accounting operations through the financial core', async () => {
    const financialCore: FinancialCoreAccountingDelegate = {
      processOutflow: jest.fn().mockResolvedValue({ invoice: { id: 'inv-1' } }),
      processOutflowWithReportingClass: jest.fn().mockResolvedValue({ invoice: { id: 'inv-hr' } }),
      processPayrollPaymentBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-2' } }]),
      cancelOperation: jest.fn().mockResolvedValue({ cancelled: true }),
    };
    const service = new AccountingCoreService(financialCore);

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
      service.postPayrollPaymentBatchInTransaction({} as OutflowBatchDto, [] as OutflowBatchInput, 'u-1', 'tenant-1'),
    ).resolves.toEqual([
      { invoice: { id: 'inv-2' } },
    ]);
    await expect(service.reverseFinancialOperation({ companyId: 'co-1' } as CancelInput, 'u-1')).resolves.toEqual({
      cancelled: true,
    });

    expect(financialCore.processOutflow).toHaveBeenCalledTimes(2);
    expect(financialCore.processOutflowWithReportingClass).toHaveBeenCalledWith(
      { companyId: 'co-1' }, 'operating_recurring_expense', 'u-1',
    );
    expect(financialCore.processPayrollPaymentBatchInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.cancelOperation).toHaveBeenCalledTimes(1);
  });
});