import fs from 'node:fs';
import path from 'node:path';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import { OwnerController } from './owner.controller';
import { buildOwnerOverviewModel } from './owner-overview-model.util';
import { OwnerService } from './owner.service';
import type { OwnerOverviewQueryDto } from './dto/owner-overview-query.dto';

function report(salesMonthOne: number): GeneralProfitLossModel {
  const sales = [salesMonthOne, ...Array(11).fill(0)];
  const zeros = Array(12).fill(0);
  return {
    amountBasis: 'gross_including_vat',
    months: Array.from({ length: 12 }, (_, index) => ({ index: index + 1, label: String(index + 1) })),
    groups: [
      { key: 'sales', labelAr: 'Sales', labelEn: 'Sales', months: sales.map(String), total: String(salesMonthOne), percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'purchases', labelAr: 'Purchases', labelEn: 'Purchases', months: zeros.map(String), total: '0', percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'expenses', labelAr: 'Expenses', labelEn: 'Expenses', months: zeros.map(String), total: '0', percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
    ],
    summaryRows: [
      { key: 'netProfit', labelAr: 'Net profit', labelEn: 'Net profit', months: sales.map(String), total: String(salesMonthOne), percentOfSalesMonths: [], percentOfSalesYear: '0' },
    ],
    cards: {
      sales: String(salesMonthOne),
      purchases: '0',
      expenses: '0',
      grossProfit: String(salesMonthOne),
      netProfit: String(salesMonthOne),
    },
  };
}

function user(role: string, companyIds: string[]): JwtUser {
  return {
    sub: 'u1',
    email: 'u1@example.com',
    role,
    companyIds,
    permissions: ['VIEW_OWNER'],
  };
}

function createService() {
  const reportsService = {
    getGeneralProfitLoss: jest.fn(async (companyId: string) => report(companyId === 'c1' ? 100 : 200)),
  };
  const salesService = {
    findDashboardPack: jest.fn(async () => ({
      yearSummaries: [],
      monthSummaries: [],
      dailySummaries: [{ transactionDate: '2026-01-01', status: 'posted', totalAmount: '50' }],
    })),
  };
  const prisma = {
    company: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ id, nameAr: `شركة ${id}`, nameEn: `Company ${id}` })),
      ),
    },
  };

  return {
    service: new OwnerService(prisma, reportsService, salesService),
    reportsService,
    salesService,
    prisma,
  };
}

describe('OwnerService', () => {
  it('filters requested companies for non-owner users before building official figures', async () => {
    const { service, reportsService, prisma } = createService();

    const result = await service.getOverview(
      { companyIds: ['c1', 'c2'], year: 2026, month: 1 },
      user('manager', ['c1']),
    );

    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1'] }, isArchived: false },
      select: { id: true, nameAr: true, nameEn: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
    expect(reportsService.getGeneralProfitLoss).toHaveBeenCalledTimes(1);
    expect(result.companies.map((company) => company.id)).toEqual(['c1']);
    expect(result.kpis.find((kpi) => kpi.key === 'sales')?.total).toBe(100);
  });

  it('allows owner users to request all selected companies', async () => {
    const { service, reportsService } = createService();

    const result = await service.getOverview(
      { companyIds: ['c1', 'c2'], year: 2026 },
      user('owner', []),
    );

    expect(reportsService.getGeneralProfitLoss).toHaveBeenCalledTimes(2);
    expect(result.companies.map((company) => company.id)).toEqual(['c1', 'c2']);
    expect(result.kpis.find((kpi) => kpi.key === 'sales')?.total).toBe(300);
  });
});

describe('OwnerController', () => {
  it('delegates owner overview requests to the service', async () => {
    const expected = buildOwnerOverviewModel({ year: 2026, month: 1, companies: [] });
    const ownerService = {
      getOverview: jest.fn(async () => expected),
    };
    const controller = new OwnerController(ownerService);
    const query: OwnerOverviewQueryDto = { companyIds: ['c1'], year: 2026, month: 1 };
    const currentUser = user('owner', []);

    await expect(controller.getOverview(query, currentUser)).resolves.toBe(expected);
    expect(ownerService.getOverview).toHaveBeenCalledWith(query, currentUser);
  });

  it('keeps the endpoint permission aligned with the owner route permission', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/owner/owner.controller.ts'), 'utf8');
    expect(source).toContain("@RequirePermission('VIEW_OWNER')");
  });
});
