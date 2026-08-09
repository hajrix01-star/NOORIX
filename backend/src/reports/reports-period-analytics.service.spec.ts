import { ReportsPeriodAnalyticsService } from './reports-period-analytics.service';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';

describe('ReportsPeriodAnalyticsService', () => {
  it('groups payroll with recurring costs and keeps ordinary expenses in their own categories', async () => {
    const invoice = {
      groupBy: jest.fn()
        .mockResolvedValueOnce([
          { kind: 'fixed_expense', _sum: { totalAmount: '200' }, _count: { _all: 1 } },
          { kind: 'expense', _sum: { totalAmount: '300' }, _count: { _all: 1 } },
          { kind: 'salary', _sum: { totalAmount: '1000' }, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ expenseLineId: 'rent-line', _sum: { totalAmount: '200' } }])
        .mockResolvedValueOnce([{ categoryId: 'maintenance-category', _sum: { totalAmount: '300' } }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null }, _count: { _all: 0 } }),
    };
    const prisma = {
      invoice,
      payrollRunItem: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { grossSalary: '1200', allowancesAdd: '0', deductions: '0' },
        }),
      },
      payrollRun: { count: jest.fn().mockResolvedValue(1) },
      expenseLine: {
        findMany: jest.fn().mockResolvedValue([{ id: 'rent-line', nameAr: 'إيجار', nameEn: 'Rent' }]),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: 'maintenance-category', nameAr: 'صيانة', nameEn: 'Maintenance' }]),
      },
    };
    const service = new ReportsPeriodAnalyticsService(prisma as unknown as TenantPrismaService);

    const result = await service.getPeriodAnalytics('company-1', '2026-08-01', '2026-08-31');

    expect(result.fixedExpenseTotal).toBe('1400.0000');
    expect(result.fixedExpenseInvoiceCount).toBe(2);
    expect(result.recurringCostCategoryBreakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'rent-line', nameAr: 'إيجار', amount: '200.0000' }),
      expect.objectContaining({ id: 'payroll', nameAr: 'الرواتب والأجور', amount: '1200.0000' }),
    ]));
    expect(result.otherExpenseTotal).toBe('300.0000');
    expect(result.otherExpenseCategoryBreakdown).toEqual([
      expect.objectContaining({ id: 'maintenance-category', nameAr: 'صيانة', amount: '300.0000', sharePct: 100 }),
    ]);
  });
});
