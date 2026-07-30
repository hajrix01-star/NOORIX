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
