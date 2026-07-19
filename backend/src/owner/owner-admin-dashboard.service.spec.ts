import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import { OwnerAdminDashboardService } from './owner-admin-dashboard.service';

function report(yearOffset: number): GeneralProfitLossModel {
  const values = Array.from({ length: 12 }, (_, index) => String(yearOffset + index + 1));
  return {
    amountBasis: 'gross_including_vat',
    months: Array.from({ length: 12 }, (_, index) => ({ index: index + 1, label: String(index + 1) })),
    groups: [
      { key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', months: values, total: '0', percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'purchases', labelAr: 'المشتريات', labelEn: 'Purchases', months: values.map((value) => String(Number(value) * 2)), total: '0', percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'expenses', labelAr: 'المصروفات', labelEn: 'Expenses', months: values.map((value) => String(Number(value) * 3)), total: '0', percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
    ],
    summaryRows: [],
    cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
  };
}

describe('OwnerAdminDashboardService', () => {
  const previousCompanyIds = process.env.ADMIN_DASHBOARD_COMPANY_IDS;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
    process.env.ADMIN_DASHBOARD_COMPANY_IDS = 'company-1';
  });

  afterEach(() => {
    jest.useRealTimers();
    if (previousCompanyIds === undefined) delete process.env.ADMIN_DASHBOARD_COMPANY_IDS;
    else process.env.ADMIN_DASHBOARD_COMPANY_IDS = previousCompanyIds;
  });

  it('returns independent source values and computes daily averages inside NOORIX', async () => {
    const prisma = {
      company: {
        findMany: jest.fn(async () => [{ id: 'company-1', nameAr: 'شركة 1', nameEn: 'Company 1' }]),
      },
    };
    const reports = {
      getGeneralProfitLoss: jest.fn(async (_companyId: string, year: number) => report(year === 2026 ? 100 : 1)),
    };
    const sales = {
      findDashboardPack: jest.fn(async () => ({
        dailySummaries: [
          { transactionDate: '2026-07-01', status: 'posted', totalAmount: '190' },
          { transactionDate: '2026-06-01', status: 'posted', totalAmount: '300' },
          { transactionDate: '2026-06-02', status: 'cancelled', totalAmount: '999' },
        ],
      })),
    };
    const service = new OwnerAdminDashboardService(prisma, reports, sales);

    const snapshot = await service.getSnapshot('tenant-1');

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.companies[0]?.dailySalesAverage).toEqual({
      currentMonthToDate: 10,
      previousFullMonth: 10,
    });
    expect(snapshot.companies[0]?.monthlyPerformance).toHaveLength(6);
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['company-1'] }, isArchived: false, tenantId: 'tenant-1' },
      select: { id: true, nameAr: true, nameEn: true },
    });
  });

  it('does not convert a missing financial source value to zero', async () => {
    const invalid = report(100);
    invalid.groups[0]!.months[6] = '';
    const service = new OwnerAdminDashboardService(
      { company: { findMany: async () => [{ id: 'company-1', nameAr: 'شركة 1', nameEn: null }] } },
      { getGeneralProfitLoss: async () => invalid },
      { findDashboardPack: async () => ({ dailySummaries: [] }) },
    );

    await expect(service.getSnapshot('tenant-1')).rejects.toThrow('Missing sales value');
  });
});
