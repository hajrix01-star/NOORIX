import { ExpenseLineService } from './expense-line.service';
import { TenantContext } from '../common/tenant-context';

describe('ExpenseLineService', () => {
  it('returns official period payment summary from backend aggregate', async () => {
    const prisma = {
      expenseLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'line-1',
          companyId: 'company-1',
          nameAr: 'Line',
          kind: 'expense',
          categoryId: 'cat-1',
          supplierId: 'supplier-1',
        }),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ id: 'invoice-page-row', totalAmount: 10 }]),
        count: jest.fn().mockResolvedValue(25),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { netAmount: 100, taxAmount: 15, totalAmount: 115 },
        }),
      },
    };

    const service = Object.create(ExpenseLineService.prototype);
    service.prisma = prisma;
    const result = await service.getPayments('line-1', 'company-1', '2026-07-01', '2026-07-31', 1, 1);

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(25);
    expect(result.periodSummary).toEqual({
      totalNet: 100,
      totalTax: 15,
      totalAmount: 115,
      count: 25,
    });
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        expenseLineId: 'line-1',
        status: 'active',
        transactionDate: {
          gte: new Date('2026-07-01T00:00:00.000Z'),
          lte: new Date('2026-07-31T23:59:59.999Z'),
        },
      },
      _sum: { netAmount: true, taxAmount: true, totalAmount: true },
    });
  });

  it('atomically keeps active linked invoices aligned when an expense line is reclassified', async () => {
    const tx = {
      expenseLine: { update: jest.fn().mockResolvedValue({ id: 'line-1', kind: 'fixed_expense' }) },
      invoice: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      expenseLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'line-1', companyId: 'company-1', nameAr: 'GOSI', kind: 'expense', categoryId: 'cat-1', supplierId: 'supplier-1',
        }),
        update: jest.fn(),
      },
      withTenant: jest.fn((fn) => fn(tx)),
    };
    const tenantId = jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    const userId = jest.spyOn(TenantContext, 'getUserId').mockReturnValue('user-1');
    const service = Object.create(ExpenseLineService.prototype);
    service.prisma = prisma;

    await service.update('line-1', 'company-1', { kind: 'fixed_expense' });

    expect(prisma.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        expenseLineId: 'line-1',
        status: 'active',
        kind: { in: ['expense', 'fixed_expense'], not: 'fixed_expense' },
      },
      data: { kind: 'fixed_expense' },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1', companyId: 'company-1', userId: 'user-1',
        entity: 'expense_line_invoice_kind_sync',
        newValue: { kind: 'fixed_expense', syncedInvoiceCount: 3 },
      }),
    }));
    tenantId.mockRestore();
    userId.mockRestore();
  });

  it('does not synchronize invoices when the source kind is unchanged', async () => {
    const prisma = {
      expenseLine: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'line-1', companyId: 'company-1', nameAr: 'GOSI', kind: 'fixed_expense', categoryId: 'cat-1', supplierId: 'supplier-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'line-1', kind: 'fixed_expense' }),
      },
      withTenant: jest.fn(),
    };
    const service = Object.create(ExpenseLineService.prototype);
    service.prisma = prisma;

    await service.update('line-1', 'company-1', { kind: 'fixed_expense' });

    expect(prisma.withTenant).not.toHaveBeenCalled();
    expect(prisma.expenseLine.update).toHaveBeenCalledTimes(1);
  });
});
