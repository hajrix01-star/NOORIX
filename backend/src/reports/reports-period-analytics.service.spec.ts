import { ReportsPeriodAnalyticsService } from './reports-period-analytics.service';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';

describe('ReportsPeriodAnalyticsService', () => {
  it('includes paid payroll in recurring operating costs without changing its invoice kind', async () => {
    const invoice = {
      groupBy: jest.fn()
        .mockResolvedValueOnce([
          { kind: 'fixed_expense', _sum: { totalAmount: '200' }, _count: { _all: 1 } },
          { kind: 'salary', _sum: { totalAmount: '1000' }, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      findMany: jest.fn()
        .mockResolvedValueOnce([
          {
            id: 'fixed-1', invoiceNumber: 'FIX-1', kind: 'fixed_expense',
            transactionDate: new Date('2026-08-01T00:00:00.000Z'), totalAmount: '200', notes: null,
            expenseLine: { nameAr: 'إيجار', nameEn: 'Rent' }, supplier: { nameAr: 'المالك', nameEn: null },
            employeeResidency: null,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'salary-1', invoiceNumber: 'SAL-202608', kind: 'salary',
            transactionDate: new Date('2026-08-02T00:00:00.000Z'), totalAmount: '1000', notes: 'مسيرة أغسطس',
            expenseLine: null, supplier: null, employeeResidency: null,
          },
        ])
        .mockResolvedValueOnce([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null }, _count: { _all: 0 } }),
    };
    const prisma = { invoice };
    const service = new ReportsPeriodAnalyticsService(prisma as unknown as TenantPrismaService);

    const result = await service.getPeriodAnalytics('company-1', '2026-08-01', '2026-08-31');

    expect(result.fixedExpenseTotal).toBe('1200.0000');
    expect(result.fixedExpenseInvoiceCount).toBe(2);
    expect(result.fixedExpenseDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({ invoiceId: 'fixed-1', nameAr: 'إيجار', sourceAr: 'المالك' }),
      expect.objectContaining({
        invoiceId: 'salary-1', nameAr: 'الرواتب والأجور', nameEn: 'Payroll and wages', sourceAr: 'مسير الرواتب',
      }),
    ]));
    expect(invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ kind: 'salary', status: 'active' }),
    }));
  });
});
