import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import { OwnerAdminDashboardService } from './owner-admin-dashboard.service';

function report(yearOffset: number): GeneralProfitLossModel {
  const values = Array.from({ length: 12 }, (_, index) => String(yearOffset + index + 1));
  return {
    amountBasis: 'gross_including_vat',
    months: Array.from({ length: 12 }, (_, index) => ({
      index: index + 1,
      label: String(index + 1),
    })),
    groups: [
      {
        key: 'sales',
        labelAr: 'المبيعات',
        labelEn: 'Sales',
        months: values,
        total: '0',
        percentOfSalesMonths: [],
        percentOfSalesYear: '0',
        items: [],
      },
      {
        key: 'purchases',
        labelAr: 'المشتريات',
        labelEn: 'Purchases',
        months: values.map((value) => String(Number(value) * 2)),
        total: '0',
        percentOfSalesMonths: [],
        percentOfSalesYear: '0',
        items: [],
      },
      {
        key: 'expenses',
        labelAr: 'المصروفات',
        labelEn: 'Expenses',
        months: values.map((value) => String(Number(value) * 3)),
        total: '0',
        percentOfSalesMonths: [],
        percentOfSalesYear: '0',
        items: [],
      },
    ],
    summaryRows: [],
    cards: {
      sales: '0',
      purchases: '0',
      expenses: '0',
      grossProfit: '0',
      netProfit: '0',
    },
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
    const rawCalls: unknown[][] = [];
    const prisma = {
      $queryRaw: async <T>(query: TemplateStringsArray, ...values: unknown[]) => {
        rawCalls.push(values);
        if (query.join(' ').includes('customer_count')) {
          const startDate = values[1] as Date;
          const currentPeriod = startDate.toISOString().startsWith('2026-07');
          return [
            currentPeriod
              ? {
                  customerCount: 360,
                  date: new Date('2026-07-18T00:00:00.000Z'),
                  shift: 'all',
                }
              : {
                  customerCount: 285,
                  date: new Date('2026-06-19T00:00:00.000Z'),
                  shift: 'all',
                },
          ] as T;
        }
        return [] as T;
      },
      company: {
        findMany: jest.fn(async () => [{ id: 'company-1', nameAr: 'شركة 1', nameEn: 'Company 1' }]),
      },
    };
    const reports = {
      getGeneralProfitLoss: jest.fn(async (_companyId: string, year: number) => report(year === 2026 ? 100 : 1)),
      getGeneralProfitLossPeriodTotals: jest.fn(async (_companyId: string, startDate: string) =>
        startDate === '2026-07-01' ? { sales: '190', purchases: '50', expenses: '30' } : { sales: '170', purchases: '40', expenses: '23' },
      ),
    };
    const service = new OwnerAdminDashboardService(prisma, reports);

    const snapshot = await service.getSnapshot('tenant-1');

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.companies[0]?.dailySalesAverage).toEqual({
      currentMonthToDate: 10,
      previousComparablePeriod: 8.95,
      previousFullMonth: 8.95,
    });
    expect(snapshot.companies[0]?.customerDailyAverage).toEqual({
      currentMonthToDate: 20,
      previousComparablePeriod: 15,
    });
    expect(snapshot.companies[0]?.sales).toMatchObject({
      current: 190,
      previous: 170,
    });
    expect(snapshot.previousPeriod).toMatchObject({
      kind: 'month-to-date',
      startDate: '2026-06-01',
      endDate: '2026-06-19',
    });
    expect(snapshot.companies[0]?.monthlyPerformance).toHaveLength(12);
    expect(snapshot.companies[0]?.monthlyPerformance[0]).toMatchObject({
      year: 2026,
      month: 7,
    });
    expect(snapshot.companies[0]?.monthlyPerformance[11]).toMatchObject({
      year: 2025,
      month: 8,
    });
    expect(snapshot.companies[0]?.executiveSnapshot).toMatchObject({
      coverage: { currentDays: 18, previousDays: 18 },
      dailySales: Array.from({ length: 14 }, expect.anything),
      latestCompleteDay: {
        date: '2026-07-18',
        sales: 0,
        previousDaySales: 0,
        changePercent: 0,
        direction: 'stable',
      },
      monthEndForecast: 0,
      salesChannels: [],
    });
    expect(reports.getGeneralProfitLossPeriodTotals).toHaveBeenNthCalledWith(1, 'company-1', '2026-07-01', '2026-07-19');
    expect(reports.getGeneralProfitLossPeriodTotals).toHaveBeenNthCalledWith(2, 'company-1', '2026-06-01', '2026-06-19');
    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['company-1'] },
        isArchived: false,
        tenantId: 'tenant-1',
      },
      select: { id: true, nameAr: true, nameEn: true },
    });
    expect(rawCalls[0]?.[1]).toEqual(new Date('2026-06-30T00:00:00.000Z'));
    expect(rawCalls[0]?.[2]).toEqual(new Date('2026-07-18T23:59:59.999Z'));
  });

  it('does not convert a missing financial source value to zero', async () => {
    const invalid = report(100);
    invalid.groups[0]!.months[6] = '';
    const service = new OwnerAdminDashboardService(
      {
        $queryRaw: async <T>() => [] as T,
        company: {
          findMany: async () => [{ id: 'company-1', nameAr: 'شركة 1', nameEn: null }],
        },
      },
      {
        getGeneralProfitLoss: async () => invalid,
        getGeneralProfitLossPeriodTotals: async () => ({
          sales: '0',
          purchases: '0',
          expenses: '0',
        }),
      },
    );

    await expect(service.getSnapshot('tenant-1')).rejects.toThrow('Missing sales value');
  });
});
