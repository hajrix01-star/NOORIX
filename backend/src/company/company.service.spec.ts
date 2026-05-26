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
});
