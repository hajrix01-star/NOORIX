import { AccountingCoreService } from './accounting-core.service';

describe('AccountingCoreService', () => {
  it('delegates HR accounting operations through the financial core', async () => {
    const financialCore = {
      processOutflow: jest.fn().mockResolvedValue({ invoice: { id: 'inv-1' } }),
      processOutflowBatchInTransaction: jest.fn().mockResolvedValue([{ invoice: { id: 'inv-2' } }]),
      cancelOperation: jest.fn().mockResolvedValue({ cancelled: true }),
    };
    const service = new AccountingCoreService(financialCore as any);

    await expect(service.postHrServiceExpense({ companyId: 'co-1' } as any, 'u-1')).resolves.toEqual({
      invoice: { id: 'inv-1' },
    });
    await expect(service.postLeaveSalarySettlement({ companyId: 'co-1' } as any, 'u-1')).resolves.toEqual({
      invoice: { id: 'inv-1' },
    });
    await expect(service.postPayrollPaymentBatchInTransaction({} as any, [] as any, 'u-1', 'tenant-1')).resolves.toEqual([
      { invoice: { id: 'inv-2' } },
    ]);
    await expect(service.reverseFinancialOperation({ companyId: 'co-1' } as any, 'u-1')).resolves.toEqual({
      cancelled: true,
    });

    expect(financialCore.processOutflow).toHaveBeenCalledTimes(2);
    expect(financialCore.processOutflowBatchInTransaction).toHaveBeenCalledTimes(1);
    expect(financialCore.cancelOperation).toHaveBeenCalledTimes(1);
  });
});
