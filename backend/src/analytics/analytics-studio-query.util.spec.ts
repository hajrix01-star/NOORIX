/**
 * Unit tests for the logic behind GET /api/v1/analytics/studio
 * (AnalyticsStudioQueryService#buildStudioPayload). Mocks do not run financial math;
 * they return minimal period blocks so we only assert scoping, permissions, and calls.
 */
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsStudioQueryService } from './analytics-studio-query.service';
import { CompanyService } from '../company/company.service';
import { ReportsService } from '../reports/reports.service';
import type { PeriodAnalyticsBlock } from './analytics-studio.types';

const RANGE = { start: '2024-06-01', end: '2024-06-30' };

function minimalBlock(): PeriodAnalyticsBlock {
  return {
    startDate: RANGE.start,
    endDate: RANGE.end,
    totalsByKind: { sale: { totalAmount: '100.0000', invoiceCount: 2 } },
    topSuppliers: [],
    supplierCategoryBreakdown: [],
    suppliersInPeriodCount: 0,
    purchaseCategoryBreakdown: [],
    purchaseCategoryTotal: '0',
  };
}

describe('AnalyticsStudioQueryService (GET /api/v1/analytics/studio)', () => {
  let service: AnalyticsStudioQueryService;
  const companyA = { id: 'c-a', nameAr: 'شركة أ', nameEn: 'A Co' };
  const companyB = { id: 'c-b', nameAr: 'شركة ب', nameEn: 'B Co' };

  let findAll: jest.Mock;
  let getPeriod: jest.Mock;

  beforeEach(() => {
    findAll = jest.fn();
    getPeriod = jest.fn().mockImplementation(() => Promise.resolve(minimalBlock()));
    const companyService = { findAll } as unknown as CompanyService;
    const reportsService = { getPeriodAnalytics: getPeriod } as unknown as ReportsService;
    service = new AnalyticsStudioQueryService(companyService, reportsService);
  });

  it('one permitted company, no companyId: aggregates that company only', async () => {
    findAll.mockResolvedValue([companyA]);
    const out = await service.buildStudioPayload(
      { role: 'accountant', companyIds: ['c-a'] },
      { startDate: RANGE.start, endDate: RANGE.end },
    );
    expect(out.companyIdsIncluded).toEqual(['c-a']);
    expect(getPeriod).toHaveBeenCalledTimes(1);
    expect(getPeriod).toHaveBeenCalledWith('c-a', RANGE.start, RANGE.end);
  });

  it('multiple permitted companies, no companyId: all companies and one analytics call per company', async () => {
    findAll.mockResolvedValue([companyA, companyB]);
    const out = await service.buildStudioPayload(
      { role: 'accountant', companyIds: ['c-a', 'c-b'] },
      { startDate: RANGE.start, endDate: RANGE.end },
    );
    expect(out.companyIdsIncluded).toEqual(['c-a', 'c-b']);
    expect(getPeriod).toHaveBeenCalledTimes(2);
    expect(getPeriod).toHaveBeenCalledWith('c-a', RANGE.start, RANGE.end);
    expect(getPeriod).toHaveBeenCalledWith('c-b', RANGE.start, RANGE.end);
  });

  it('allowed companyId: only that id and a single getPeriod call', async () => {
    findAll.mockResolvedValue([companyA, companyB]);
    const out = await service.buildStudioPayload(
      { role: 'accountant', companyIds: ['c-a', 'c-b'] },
      { startDate: RANGE.start, endDate: RANGE.end, companyId: 'c-b' },
    );
    expect(out.companyIdsIncluded).toEqual(['c-b']);
    expect(out.companyScope).toBe('single');
    expect(getPeriod).toHaveBeenCalledTimes(1);
    expect(getPeriod).toHaveBeenCalledWith('c-b', RANGE.start, RANGE.end);
  });

  it('forbidden companyId: rejects with ForbiddenException', async () => {
    findAll.mockResolvedValue([companyA]);
    await expect(
      service.buildStudioPayload(
        { role: 'accountant', companyIds: ['c-a'] },
        { startDate: RANGE.start, endDate: RANGE.end, companyId: 'c-b' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getPeriod).not.toHaveBeenCalled();
  });

  it('user with no companies (non-super-admin): empty payload, no findAll, no getPeriod', async () => {
    const out = await service.buildStudioPayload(
      { role: 'accountant', companyIds: [] },
      { startDate: RANGE.start, endDate: RANGE.end },
    );
    expect(out.companyIdsIncluded).toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
    expect(getPeriod).not.toHaveBeenCalled();
  });

  it('super admin with no companyIds: still calls findAll without id filter; empty DB yields empty payload', async () => {
    findAll.mockResolvedValue([]);
    const out = await service.buildStudioPayload(
      { role: 'owner', companyIds: [] },
      { startDate: RANGE.start, endDate: RANGE.end },
    );
    expect(findAll).toHaveBeenCalledWith(false, undefined);
    expect(out.companyIdsIncluded).toEqual([]);
    expect(getPeriod).not.toHaveBeenCalled();
  });
});
