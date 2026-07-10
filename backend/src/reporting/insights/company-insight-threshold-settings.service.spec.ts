import { BadRequestException } from '@nestjs/common';
import { CompanyInsightThresholdSettingsService } from './company-insight-threshold-settings.service';
import {
  DEFAULT_GENERIC_INSIGHT_THRESHOLDS,
  mergeInsightThresholds,
  validateInsightThresholds,
} from './company-insight-thresholds';

describe('CompanyInsightThresholdSettingsService', () => {
  const companyId = 'co-1';

  const mkPrisma = () => ({
    companyInsightSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  });

  it('getResolvedThresholds: no row returns generic defaults (same as merge with no overrides)', async () => {
    const prisma = mkPrisma();
    prisma.companyInsightSettings.findUnique.mockResolvedValue(null);
    const svc = new CompanyInsightThresholdSettingsService(prisma);
    const out = await svc.getResolvedThresholds(companyId);
    const expected = mergeInsightThresholds(undefined);
    expect(out).toEqual(expected);
  });

  it('getResolvedThresholds: merges stored JSON partial with generic defaults', async () => {
    const prisma = mkPrisma();
    prisma.companyInsightSettings.findUnique.mockResolvedValue({
      thresholds: { purchaseToSales: { warning: 0.7 } },
    });
    const svc = new CompanyInsightThresholdSettingsService(prisma);
    const out = await svc.getResolvedThresholds(companyId);
    const expected = mergeInsightThresholds({ purchaseToSales: { warning: 0.7 } });
    expect(out).toEqual(expected);
    expect(out.purchaseToSales.warning).toBe(0.7);
    expect(out.purchaseToSales.critical).toBe(
      DEFAULT_GENERIC_INSIGHT_THRESHOLDS.purchaseToSales.critical,
    );
  });

  it('updateStoredThresholds: stores merged partial and returns resolved payload', async () => {
    const prisma = mkPrisma();
    prisma.companyInsightSettings.findUnique.mockResolvedValue(null);
    prisma.companyInsightSettings.upsert.mockResolvedValue({});
    const svc = new CompanyInsightThresholdSettingsService(prisma);
    const patch = { purchaseToSales: { warning: 0.66, critical: 0.78 } as const };
    const out = await svc.updateStoredThresholds(companyId, patch);
    validateInsightThresholds(out);
    expect(out.purchaseToSales).toEqual({ warning: 0.66, critical: 0.78 });
    expect(prisma.companyInsightSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId },
        create: expect.objectContaining({ companyId, thresholds: patch }),
        update: { thresholds: patch },
      }),
    );
  });

  it('updateStoredThresholds: fails when resolved warning >= critical (ratio band)', async () => {
    const prisma = mkPrisma();
    prisma.companyInsightSettings.findUnique.mockResolvedValue(null);
    const svc = new CompanyInsightThresholdSettingsService(prisma);
    await expect(
      svc.updateStoredThresholds(companyId, {
        purchaseToSales: { warning: 0.7, critical: 0.65 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.companyInsightSettings.upsert).not.toHaveBeenCalled();
  });

  it('resetStoredThresholds: deletes row and returns generic defaults', async () => {
    const prisma = mkPrisma();
    prisma.companyInsightSettings.deleteMany.mockResolvedValue({ count: 1 });
    const svc = new CompanyInsightThresholdSettingsService(prisma);
    const out = await svc.resetStoredThresholds(companyId);
    expect(out).toEqual(mergeInsightThresholds(undefined));
    expect(prisma.companyInsightSettings.deleteMany).toHaveBeenCalledWith({ where: { companyId } });
  });
});
