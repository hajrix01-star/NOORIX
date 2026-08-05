import { CompanyService } from './company.service';

describe('CompanyService.update', () => {
  const companyId = 'co-1';

  const mkService = () => {
    const prisma = {
      company: {
        update: jest.fn().mockResolvedValue({
          id: companyId,
          nameAr: 'شركة',
          salesShiftsEnabled: true,
        }),
      },
    };
    const accountingInit = { initializeCompanyAccounting: jest.fn() };
    const svc = new CompanyService(
      prisma as never,
      accountingInit as never,
    );
    return { svc, prisma };
  };

  it('persists salesShiftsEnabled when provided in dto', async () => {
    const { svc, prisma } = mkService();
    await svc.update(companyId, { salesShiftsEnabled: true });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { salesShiftsEnabled: true },
    });
  });

  it('does not touch salesShiftsEnabled when omitted from dto', async () => {
    const { svc, prisma } = mkService();
    await svc.update(companyId, { nameAr: 'جديد' });
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: companyId },
      data: { nameAr: 'جديد' },
    });
  });

  it('moves a company to the requested display position and normalizes the sequence', async () => {
    const tx = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'co-a', sortOrder: 1 },
          { id: companyId, sortOrder: 2 },
          { id: 'co-c', sortOrder: 3 },
        ]),
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: companyId, sortOrder: 1 }),
      },
    };
    const prisma = { withTenant: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    const svc = new CompanyService(prisma as never, { initializeCompanyAccounting: jest.fn() } as never);

    await expect(svc.update(companyId, { sortOrder: 1 })).resolves.toMatchObject({ sortOrder: 1 });
    expect(tx.company.update).toHaveBeenNthCalledWith(1, { where: { id: companyId }, data: { sortOrder: 1 } });
    expect(tx.company.update).toHaveBeenNthCalledWith(2, { where: { id: 'co-a' }, data: { sortOrder: 2 } });
  });
});
