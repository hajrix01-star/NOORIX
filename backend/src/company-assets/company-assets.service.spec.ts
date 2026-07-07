import { CompanyAssetsService } from './company-assets.service';

describe('CompanyAssetsService', () => {
  it('returns filtered acquisition summary separately from company total', async () => {
    const prisma = {
      companyAsset: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(3),
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { acquisitionCost: 300 } })
          .mockResolvedValueOnce({ _sum: { acquisitionCost: 900 } }),
      },
    };
    const service = Object.create(CompanyAssetsService.prototype);
    service.prisma = prisma;

    const result = await service.findAll('company-1', {
      warrantyFilter: 'expired',
      q: 'oven',
      page: 1,
      pageSize: 50,
    });

    expect(result.total).toBe(3);
    expect(result.sumAcquisitionCostFiltered).toBe('300');
    expect(result.sumAcquisitionCostAll).toBe('900');
    const filteredAggregateCall = prisma.companyAsset.aggregate.mock.calls[0]?.[0];
    expect(filteredAggregateCall.where.companyId).toBe('company-1');
    expect(filteredAggregateCall.where.warrantyEndDate.lt instanceof Date).toBe(true);
    expect(filteredAggregateCall._sum).toEqual({ acquisitionCost: true });
    expect(prisma.companyAsset.aggregate).toHaveBeenNthCalledWith(2, {
      where: { companyId: 'company-1' },
      _sum: { acquisitionCost: true },
    });
  });

  it('limits pending warranty invoices for large queues', async () => {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = Object.create(CompanyAssetsService.prototype);
    service.prisma = prisma;

    await service.findPendingWarrantyInvoices('company-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        companyId: 'company-1',
        warrantyFollowUp: true,
        warrantyFollowUpDone: false,
      }),
      take: 200,
    }));
  });
});
