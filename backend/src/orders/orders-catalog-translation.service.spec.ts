import { GeminiService } from '../chat/gemini.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OrdersCatalogService } from './orders-catalog.service';

describe('OrdersCatalogService catalog translations', () => {
  it('builds contextual suggestions only for products missing an English name', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'product-1',
        nameAr: 'منظف ارضيات',
        nameEn: null,
        unit: 'عبوة',
        productType: 'order',
        category: { nameAr: 'نظافة', nameEn: 'Cleaning' },
      },
      {
        id: 'product-2',
        nameAr: 'برتقال',
        nameEn: 'Orange',
        unit: 'كيلو',
        productType: 'order',
        category: { nameAr: 'فاكهة', nameEn: 'Fruit' },
      },
    ]);
    const translateRestaurantCatalogItems = jest.fn().mockResolvedValue([
      {
        id: 'product-1',
        suggestedNameEn: 'Floor Cleaner',
        classification: 'cleaning',
        confidence: 0.98,
        needsReview: false,
      },
    ]);
    const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
    Object.defineProperty(prisma, 'orderProduct', { value: { findMany } });
    const gemini = Object.create(GeminiService.prototype) as GeminiService;
    Object.defineProperty(gemini, 'translateRestaurantCatalogItems', {
      value: translateRestaurantCatalogItems,
    });
    const service = new OrdersCatalogService(prisma, gemini);

    const result = await service.previewMissingProductTranslations('company-1', 'order', 30);

    expect(translateRestaurantCatalogItems).toHaveBeenCalledWith([
      {
        id: 'product-1',
        nameAr: 'منظف ارضيات',
        categoryAr: 'نظافة',
        categoryEn: 'Cleaning',
        unit: 'عبوة',
        productType: 'order',
      },
    ]);
    expect(result).toEqual({
      suggestions: [
        {
          productId: 'product-1',
          nameAr: 'منظف ارضيات',
          categoryAr: 'نظافة',
          unit: 'عبوة',
          productType: 'order',
          suggestedNameEn: 'Floor Cleaner',
          classification: 'cleaning',
          confidence: 0.98,
          needsReview: false,
        },
      ],
      totalMissing: 1,
      truncated: false,
    });
  });

  it('atomically updates only active untranslated products in the same company', async () => {
    const updateMany = jest.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    type Transaction = { orderProduct: { updateMany: typeof updateMany } };
    const withTenant = jest.fn((callback: (tx: Transaction) => Promise<number>) => (
      callback({ orderProduct: { updateMany } })
    ));
    const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
    Object.defineProperty(prisma, 'withTenant', { value: withTenant });
    const gemini = Object.create(GeminiService.prototype) as GeminiService;
    const service = new OrdersCatalogService(prisma, gemini);

    const result = await service.applyProductTranslations('company-1', [
      { productId: 'product-1', nameEn: '  Orange   Juice  ' },
      { productId: 'product-2', nameEn: 'Floor Cleaner' },
    ]);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'product-1',
        companyId: 'company-1',
        isActive: true,
        OR: [{ nameEn: null }, { nameEn: '' }],
      },
      data: { nameEn: 'Orange Juice' },
    });
    expect(result).toEqual({ updatedCount: 1, skippedCount: 1 });
  });

  it('limits each AI request to a reliable batch while reporting all missing names', async () => {
    const products = Array.from({ length: 18 }, (_, index) => ({
      id: `product-${index + 1}`,
      nameAr: `Product ${index + 1}`,
      nameEn: null,
      unit: 'piece',
      productType: 'order',
      category: null,
    }));
    const findMany = jest.fn().mockResolvedValue(products);
    const translateRestaurantCatalogItems = jest.fn().mockImplementation(async (
      items: Array<{ id: string; nameAr: string }>,
    ) => (
      items.map((item) => ({
        id: item.id,
        suggestedNameEn: item.nameAr,
        classification: 'other',
        confidence: 0.9,
        needsReview: false,
      }))
    ));
    const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
    Object.defineProperty(prisma, 'orderProduct', { value: { findMany } });
    const gemini = Object.create(GeminiService.prototype) as GeminiService;
    Object.defineProperty(gemini, 'translateRestaurantCatalogItems', {
      value: translateRestaurantCatalogItems,
    });
    const service = new OrdersCatalogService(prisma, gemini);

    const result = await service.previewMissingProductTranslations('company-1', 'order', 50);

    expect(translateRestaurantCatalogItems).toHaveBeenCalledWith(expect.any(Array));
    expect(translateRestaurantCatalogItems.mock.calls[0][0]).toHaveLength(15);
    expect(result.suggestions).toHaveLength(15);
    expect(result.totalMissing).toBe(18);
    expect(result.truncated).toBe(true);
  });

  it('rejects an empty AI result when untranslated products exist', async () => {
    const findMany = jest.fn().mockResolvedValue([{
      id: 'product-1',
      nameAr: 'Orange',
      nameEn: null,
      unit: 'piece',
      productType: 'order',
      category: null,
    }]);
    const prisma = Object.create(TenantPrismaService.prototype) as TenantPrismaService;
    Object.defineProperty(prisma, 'orderProduct', { value: { findMany } });
    const gemini = Object.create(GeminiService.prototype) as GeminiService;
    Object.defineProperty(gemini, 'translateRestaurantCatalogItems', {
      value: jest.fn().mockResolvedValue([]),
    });
    const service = new OrdersCatalogService(prisma, gemini);

    await expect(service.previewMissingProductTranslations('company-1', 'order', 50))
      .rejects.toThrow('Catalog translation service returned no usable suggestions.');
  });
});
