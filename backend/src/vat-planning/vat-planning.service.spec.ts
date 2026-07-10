import { Prisma } from '@prisma/client';
import { VatPlanningService } from './vat-planning.service';
import type { JwtUser } from '../auth/decorators/current-user.decorator';
import { TenantContext } from '../common/tenant-context';

describe('VatPlanningService', () => {
  const user: JwtUser = {
    sub: 'user-1',
    email: 'auditor@example.com',
    role: 'admin',
    companyIds: ['company-1'],
    permissions: ['HAJRI_TAX_WRITE'],
  };

  it('normalizes planning payload summaries in the backend before saving', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'vat-1',
      companyId: 'company-1',
      year: 2026,
      quarter: 2,
      payload: {},
      sourceSnapshot: null,
      paymentTarget: new Prisma.Decimal('9'),
      notes: null,
      importedAt: null,
      filingSubmitted: true,
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      company: { id: 'company-1', nameAr: 'Company', nameEn: null, taxNumber: '300', isArchived: false },
    });
    const prisma = {
      company: {
        findFirst: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
      vatPlanningQuarter: { upsert },
    };

    const service = Object.create(VatPlanningService.prototype) as VatPlanningService;
    Object.defineProperty(service, 'prisma', { value: prisma });
    await new Promise<void>((resolve, reject) => {
      TenantContext.run('tenant-1', 'user-1', () => {
        service.upsert(user, {
          companyId: 'company-1',
          year: 2026,
          quarter: 2,
          payload: {
            standard_sales: { amount: '100.125', adjustment: 0, vat: '15.129' },
            standard_purchases: { amount: 40, adjustment: 0, vat: '6.124' },
            prior_adjustments: '1.335',
            balance_carried: '-0.335',
            vat_due: 999,
          },
          paymentTarget: 9,
          filingSubmitted: true,
        }).then(() => resolve(), reject);
      });
    });

    const createPayload = upsert.mock.calls[0]?.[0]?.create?.payload;
    expect(createPayload).toEqual({
      standard_sales: { amount: 100.13, adjustment: 0, vat: 15.13 },
      standard_purchases: { amount: 40, adjustment: 0, vat: 6.12 },
      vat_due: 15.13,
      vat_recoverable: 6.12,
      net_vat: 9.01,
      prior_adjustments: 1.34,
      balance_carried: -0.33,
      net_payable_refund: 10.02,
    });
  });

  it('returns registry filter metadata without loading registry payload rows', async () => {
    const prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'company-1', nameAr: 'A', nameEn: null, taxNumber: '3001', isArchived: false },
        ]),
      },
      vatPlanningQuarter: {
        groupBy: jest.fn().mockResolvedValue([{ year: 2026 }, { year: 2025 }]),
      },
    };

    const service = Object.create(VatPlanningService.prototype) as VatPlanningService;
    Object.defineProperty(service, 'prisma', { value: prisma });

    const result = await service.registryMetadata(user);

    expect(result.data).toEqual({
      companies: [{ id: 'company-1', nameAr: 'A', nameEn: null, taxNumber: '3001', isArchived: false }],
      years: [2026, 2025],
    });
    expect(prisma.vatPlanningQuarter.groupBy).toHaveBeenCalledWith({
      by: ['year'],
      where: { companyId: { in: ['company-1'] } },
      orderBy: { year: 'desc' },
    });
  });
});
