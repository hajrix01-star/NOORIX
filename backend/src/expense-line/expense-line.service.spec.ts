import { ExpenseLineService } from './expense-line.service';

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
});
