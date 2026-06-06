import { learnItemAliasIfNeeded, learnSupplierAliasIfNeeded } from './ocr-alias-learning.util';

describe('ocr-alias-learning guardrails', () => {
  it('does not learn item alias for non-auto matches', async () => {
    const prisma = {
      ocrItemAlias: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const logger = { log: jest.fn() } as any;
    const items = [{ id: 'item-1', nameAr: 'نعناع الفاخر', aliases: [] }];
    const seen = new Set<string>();

    await learnItemAliasIfNeeded(
      prisma,
      logger,
      items,
      { id: 'item-1', score: 0.99, status: 'review' },
      'عنب نعناع الفاخر',
      seen,
    );

    expect(prisma.ocrItemAlias.create).not.toHaveBeenCalled();
  });

  it('learns supplier alias only for high-confidence auto matches', async () => {
    const prisma = {
      ocrSupplierAlias: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const logger = { log: jest.fn() } as any;
    const suppliers = [{ id: 'sup-1', nameAr: 'شركة الراجحي', aliases: [] }];
    const seen = new Set<string>();

    await learnSupplierAliasIfNeeded(
      prisma,
      logger,
      suppliers,
      { id: 'sup-1', score: 0.96, status: 'auto' },
      'شركة الراجحي التجارية',
      seen,
    );

    expect(prisma.ocrSupplierAlias.create).toHaveBeenCalledTimes(1);
  });
});
