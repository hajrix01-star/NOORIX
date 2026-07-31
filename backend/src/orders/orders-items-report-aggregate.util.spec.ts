import { Prisma } from '@prisma/client';
import {
  aggregateOrderItemsForRangeReport,
  aggregateRecipeInventoryStock,
} from './orders-items-report-aggregate.util';

describe('aggregateOrderItemsForRangeReport', () => {
  const product = {
    id: 'charcoal',
    nameAr: 'فحم',
    nameEn: 'Charcoal',
    categoryId: 'category-charcoal',
    unit: 'pack',
    sections: ['شيشة', 'بار'],
    sectionIds: ['section-shisha', 'section-bar'],
    category: { nameAr: 'فحم', nameEn: 'Charcoal' },
  };

  it('separates variants, applies quantity multipliers, and counts distinct orders', () => {
    const report = aggregateOrderItemsForRangeReport([
      {
        productId: product.id,
        packaging: 'كرتون',
        unit: 'carton',
        quantity: new Prisma.Decimal(1),
        quantityMultiplier: new Prisma.Decimal(10),
        unitPrice: new Prisma.Decimal(100),
        amount: new Prisma.Decimal(100),
        order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
        product,
      },
      {
        productId: product.id,
        packaging: 'كرتون',
        unit: 'carton',
        quantity: new Prisma.Decimal('0.5'),
        quantityMultiplier: new Prisma.Decimal(10),
        unitPrice: new Prisma.Decimal(100),
        amount: new Prisma.Decimal(50),
        order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
        product,
      },
      {
        productId: product.id,
        packaging: 'علبة',
        unit: 'pack',
        quantity: new Prisma.Decimal(1),
        quantityMultiplier: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(10),
        amount: new Prisma.Decimal(10),
        order: { id: 'order-2', orderDate: new Date('2026-07-02T00:00:00.000Z'), orderType: 'internal' },
        product,
      },
    ]);

    expect(report.rows).toHaveLength(2);
    expect(report.summary).toEqual({
      totalAmount: '160',
      distinctOrders: 2,
      distinctProducts: 1,
      sectionsCount: 1,
    });

    const carton = report.rows.find((row) => row.packaging === 'كرتون');
    expect(carton).toMatchObject({
      quantity: '1.5',
      normalizedQuantity: '15',
      amount: '150',
      orderCount: 1,
      baseUnit: 'pack',
      sectionName: 'مشترك',
    });
    expect(carton?.daily).toEqual([
      expect.objectContaining({
        date: '2026-07-01',
        normalizedQuantity: '15',
        orderCount: 1,
      }),
    ]);
  });

  it('keeps range report quantities on the stored line multiplier snapshot', () => {
    const charcoal = {
      id: 'charcoal-converted',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      categoryId: 'category-charcoal',
      unit: 'piece',
      sections: ['bar'],
      sectionIds: ['section-bar'],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
      category: { nameAr: 'Charcoal', nameEn: 'Charcoal' },
    };

    const report = aggregateOrderItemsForRangeReport([
      {
        productId: charcoal.id,
        packaging: 'carton',
        unit: 'carton',
        quantity: new Prisma.Decimal(2),
        quantityMultiplier: new Prisma.Decimal(600),
        unitPrice: new Prisma.Decimal(145),
        amount: new Prisma.Decimal(290),
        order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
        product: charcoal,
      },
    ]);

    expect(report.rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal-converted',
        quantity: '2',
        normalizedQuantity: '1200',
        baseUnit: 'piece',
      }),
    ]);
    expect(report.rows[0]?.daily).toEqual([
      expect.objectContaining({
        normalizedQuantity: '1200',
      }),
    ]);
  });

  it('falls back to product conversions only when a stored multiplier is missing', () => {
    const charcoal = {
      id: 'charcoal-fallback',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      categoryId: 'category-charcoal',
      unit: 'piece',
      sections: ['bar'],
      sectionIds: ['section-bar'],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
      category: { nameAr: 'Charcoal', nameEn: 'Charcoal' },
    };

    const report = aggregateOrderItemsForRangeReport([
      {
        productId: charcoal.id,
        packaging: 'carton',
        unit: 'carton',
        quantity: new Prisma.Decimal(2),
        quantityMultiplier: null,
        unitPrice: new Prisma.Decimal(145),
        amount: new Prisma.Decimal(290),
        order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
        product: charcoal,
      },
    ]);

    expect(report.rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal-fallback',
        normalizedQuantity: '1280',
        baseUnit: 'piece',
      }),
    ]);
  });
});

describe('aggregateRecipeInventoryStock', () => {
  it('adds purchased material stock and consumes it from sold item recipes', () => {
    const orange = {
      id: 'orange',
      nameAr: 'برتقال',
      nameEn: 'Orange',
      unit: 'piece',
    };
    const juice = {
      id: 'orange-juice',
      nameAr: 'عصير برتقال',
      nameEn: 'Orange juice',
      unit: 'cup',
      recipe: [
        { materialType: 'material', materialProductId: 'orange', quantity: '3', unit: 'piece' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [orange],
      purchases: [
        {
          productId: 'orange',
          quantity: new Prisma.Decimal(1),
          quantityMultiplier: new Prisma.Decimal(10),
          product: orange,
        },
      ],
      sales: [
        {
          productId: 'orange-juice',
          quantity: new Prisma.Decimal(2),
          quantityMultiplier: new Prisma.Decimal(1),
          product: juice,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'orange',
        purchasedBaseQuantity: '10',
        consumedBaseQuantity: '6',
        balanceBaseQuantity: '4',
      }),
    ]);
  });

  it('uses product unit conversions when recipes consume a different unit', () => {
    const orange = {
      id: 'orange',
      nameAr: 'Orange',
      nameEn: 'Orange',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'kg', toUnit: 'piece', multiplier: '6' },
      ],
    };
    const juice = {
      id: 'orange-juice',
      nameAr: 'Orange juice',
      nameEn: 'Orange juice',
      unit: 'cup',
      recipe: [
        { materialType: 'material', materialProductId: 'orange', quantity: '0.5', unit: 'kg' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [orange],
      purchases: [
        {
          productId: 'orange',
          quantity: new Prisma.Decimal(2),
          quantityMultiplier: new Prisma.Decimal(6),
          product: orange,
        },
      ],
      sales: [
        {
          productId: 'orange-juice',
          quantity: new Prisma.Decimal(3),
          quantityMultiplier: new Prisma.Decimal(1),
          product: juice,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'orange',
        unit: 'piece',
        purchasedBaseQuantity: '12',
        consumedBaseQuantity: '9',
        balanceBaseQuantity: '3',
      }),
    ]);
  });

  it('normalizes chained purchase units before recipe consumption', () => {
    const charcoal = {
      id: 'charcoal',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };
    const shisha = {
      id: 'shisha',
      nameAr: 'Shisha',
      nameEn: 'Shisha',
      unit: 'piece',
      recipe: [
        { materialType: 'material', materialProductId: 'charcoal', quantity: '10', unit: 'piece' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [charcoal],
      purchases: [
        {
          productId: 'charcoal',
          quantity: new Prisma.Decimal(2),
          quantityMultiplier: new Prisma.Decimal(640),
          product: charcoal,
        },
      ],
      sales: [
        {
          productId: 'shisha',
          quantity: new Prisma.Decimal(5),
          quantityMultiplier: new Prisma.Decimal(1),
          product: shisha,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal',
        unit: 'piece',
        purchasedBaseQuantity: '1280',
        consumedBaseQuantity: '50',
        balanceBaseQuantity: '1230',
      }),
    ]);
  });

  it('keeps purchased material stock on the stored line multiplier snapshot', () => {
    const charcoal = {
      id: 'charcoal',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [charcoal],
      purchases: [
        {
          productId: 'charcoal',
          quantity: new Prisma.Decimal(2),
          unit: 'carton',
          quantityMultiplier: new Prisma.Decimal(600),
          product: charcoal,
        },
      ],
      sales: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal',
        unit: 'piece',
        purchasedBaseQuantity: '1200',
        consumedBaseQuantity: '0',
        balanceBaseQuantity: '1200',
      }),
    ]);
  });

  it('uses selected purchase unit conversions when the stored multiplier is missing', () => {
    const charcoal = {
      id: 'charcoal',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [charcoal],
      purchases: [
        {
          productId: 'charcoal',
          quantity: new Prisma.Decimal(2),
          unit: 'carton',
          quantityMultiplier: null,
          product: charcoal,
        },
      ],
      sales: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal',
        unit: 'piece',
        purchasedBaseQuantity: '1280',
        consumedBaseQuantity: '0',
        balanceBaseQuantity: '1280',
      }),
    ]);
  });

  it('uses product conversions for legacy rows with a default multiplier of one and a non-base unit', () => {
    const charcoal = {
      id: 'charcoal-legacy',
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [charcoal],
      purchases: [
        {
          productId: 'charcoal-legacy',
          quantity: new Prisma.Decimal(2),
          unit: 'carton',
          quantityMultiplier: new Prisma.Decimal(1),
          product: charcoal,
        },
      ],
      sales: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'charcoal-legacy',
        unit: 'piece',
        purchasedBaseQuantity: '1280',
        consumedBaseQuantity: '0',
        balanceBaseQuantity: '1280',
      }),
    ]);
  });

  it('rejects recipe consumption when the material unit has no conversion path', () => {
    const orange = {
      id: 'orange',
      nameAr: 'Orange',
      nameEn: 'Orange',
      productType: 'order',
      unit: 'piece',
    };
    const juice = {
      id: 'orange-juice',
      nameAr: 'Orange juice',
      nameEn: 'Orange juice',
      productType: 'sale',
      unit: 'cup',
      recipe: [
        { materialType: 'material', materialProductId: 'orange', quantity: '0.5', unit: 'box' },
      ],
    };

    expect(() => aggregateRecipeInventoryStock({
      materialProducts: [orange],
      purchases: [],
      sales: [
        {
          productId: 'orange-juice',
          quantity: new Prisma.Decimal(1),
          unit: 'cup',
          quantityMultiplier: new Prisma.Decimal(1),
          product: juice,
        },
      ],
    })).toThrow('Missing inventory conversion');
  });

  it('reverses consumption when a sold item is cancelled', () => {
    const orange = {
      id: 'orange',
      nameAr: 'Ø¨Ø±ØªÙ‚Ø§Ù„',
      nameEn: 'Orange',
      unit: 'piece',
    };
    const juice = {
      id: 'orange-juice',
      nameAr: 'Ø¹ØµÙŠØ± Ø¨Ø±ØªÙ‚Ø§Ù„',
      nameEn: 'Orange juice',
      unit: 'cup',
      recipe: [
        { materialType: 'material', materialProductId: 'orange', quantity: '3', unit: 'piece' },
      ],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [orange],
      purchases: [
        {
          productId: 'orange',
          quantity: new Prisma.Decimal(1),
          quantityMultiplier: new Prisma.Decimal(10),
          product: orange,
        },
      ],
      sales: [
        {
          productId: 'orange-juice',
          quantity: new Prisma.Decimal(2),
          quantityMultiplier: new Prisma.Decimal(1),
          product: juice,
        },
        {
          productId: 'orange-juice',
          quantity: new Prisma.Decimal(-1),
          quantityMultiplier: new Prisma.Decimal(1),
          product: juice,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'orange',
        purchasedBaseQuantity: '10',
        consumedBaseQuantity: '3',
        balanceBaseQuantity: '7',
      }),
    ]);
  });
});
