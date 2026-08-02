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
    const historicalItem = {
      productId: charcoal.id,
      packaging: 'carton',
      unit: 'carton',
      quantity: new Prisma.Decimal(2),
      quantityMultiplier: new Prisma.Decimal(600),
      unitPrice: new Prisma.Decimal(145),
      amount: new Prisma.Decimal(290),
      order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
    };
    const reports = [
      charcoal,
      {
        ...charcoal,
        inventoryConversions: [
          { fromUnit: 'carton', toUnit: 'piece', multiplier: '999' },
        ],
      },
    ].map((currentProduct) => aggregateOrderItemsForRangeReport([
      { ...historicalItem, product: currentProduct },
    ]));

    for (const report of reports) {
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
    }
  });

  it('keeps range report quantities on the base snapshot after product conversions change', () => {
    const historicalItem = {
      productId: 'charcoal-snapshot',
      packaging: 'carton',
      unit: 'carton',
      quantity: new Prisma.Decimal(2),
      quantityMultiplier: new Prisma.Decimal(600),
      inventoryBaseQuantitySnapshot: new Prisma.Decimal(128),
      unitPrice: new Prisma.Decimal(145),
      amount: new Prisma.Decimal(290),
      order: { id: 'order-1', orderDate: new Date('2026-07-01T00:00:00.000Z'), orderType: 'external' },
    };
    const productWithConversion = (multiplier: string) => ({
      id: historicalItem.productId,
      nameAr: 'Charcoal',
      nameEn: 'Charcoal',
      categoryId: 'category-charcoal',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'piece', multiplier },
      ],
      category: { nameAr: 'Charcoal', nameEn: 'Charcoal' },
    });

    const normalizedQuantities = ['64', '999'].map((multiplier) => (
      aggregateOrderItemsForRangeReport([
        { ...historicalItem, product: productWithConversion(multiplier) },
      ]).rows[0]?.normalizedQuantity
    ));

    expect(normalizedQuantities).toEqual(['128', '128']);
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
  it('combines database aggregates with legacy rows without changing stock arithmetic', () => {
    const material = {
      id: 'material-aggregate',
      nameAr: 'Material',
      nameEn: 'Material',
      unit: 'piece',
      productType: 'order',
    };

    const [row] = aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [{
        productId: material.id,
        quantity: new Prisma.Decimal(5),
        unit: 'piece',
        quantityMultiplier: new Prisma.Decimal(1),
        product: material,
      }],
      sales: [],
      aggregatedPurchases: [{ productId: material.id, quantityBase: '100' }],
      aggregatedConsumption: [{ productId: material.id, quantityBase: '30' }],
      adjustments: [{ productId: material.id, quantityBase: '-2' }],
    });

    expect(row).toEqual(expect.objectContaining({
      purchasedBaseQuantity: '105',
      consumedBaseQuantity: '30',
      adjustmentBaseQuantity: '-2',
      balanceBaseQuantity: '73',
    }));
  });

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

  it('keeps a stored multiplier of one after product conversions change', () => {
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
    const historicalPurchase = {
      productId: 'charcoal-legacy',
      quantity: new Prisma.Decimal(2),
      unit: 'carton',
      quantityMultiplier: new Prisma.Decimal(1),
    };
    const rowsByConversion = [
      charcoal,
      {
        ...charcoal,
        inventoryConversions: [
          { fromUnit: 'carton', toUnit: 'piece', multiplier: '999' },
        ],
      },
    ].map((currentProduct) => aggregateRecipeInventoryStock({
      materialProducts: [currentProduct],
      purchases: [{ ...historicalPurchase, product: currentProduct }],
      sales: [],
    }));

    for (const rows of rowsByConversion) {
      expect(rows).toEqual([
        expect.objectContaining({
          productId: 'charcoal-legacy',
          unit: 'piece',
          purchasedBaseQuantity: '2',
          consumedBaseQuantity: '0',
          balanceBaseQuantity: '2',
        }),
      ]);
    }
  });

  it('recovers a legacy purchase with a drifted unit from its stored multiplier', () => {
    const cream = {
      id: 'legacy-cream',
      nameAr: 'Legacy cream',
      nameEn: 'Legacy cream',
      productType: 'order',
      unit: 'piece',
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [cream],
      purchases: [
        {
          productId: cream.id,
          quantity: new Prisma.Decimal(3),
          unit: 'piece/ml',
          quantityMultiplier: new Prisma.Decimal(1),
          inventoryBaseQuantitySnapshot: null,
          product: cream,
        },
      ],
      sales: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: cream.id,
        unit: 'piece',
        purchasedBaseQuantity: '3',
        consumedBaseQuantity: '0',
        balanceBaseQuantity: '3',
      }),
    ]);
  });

  it('aggregates legacy Arabic unit labels against canonical product units', () => {
    const material = {
      id: 'legacy-arabic-piece',
      nameAr: 'مادة قديمة',
      nameEn: 'Legacy material',
      productType: 'order',
      unit: 'piece',
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [
        {
          productId: material.id,
          quantity: new Prisma.Decimal(45),
          unit: 'حبة',
          quantityMultiplier: new Prisma.Decimal(1),
          inventoryBaseQuantitySnapshot: null,
          product: material,
        },
      ],
      sales: [],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: material.id,
        unit: 'piece',
        purchasedBaseQuantity: '45',
        consumedBaseQuantity: '0',
        balanceBaseQuantity: '45',
      }),
    ]);
  });

  it('rejects a purchase when its explicit conversion chain is disconnected', () => {
    const material = {
      id: 'unrecoverable-legacy-material',
      nameAr: 'Unrecoverable material',
      nameEn: 'Unrecoverable material',
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'box', multiplier: '10' },
        { fromUnit: 'pack', toUnit: 'piece', multiplier: '64' },
      ],
    };

    expect(() => aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [
        {
          productId: material.id,
          quantity: new Prisma.Decimal(3),
          unit: 'carton',
          quantityMultiplier: null,
          inventoryBaseQuantitySnapshot: null,
          product: material,
        },
      ],
      sales: [],
    })).toThrow('Missing inventory conversion');
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

  it('applies immutable stocktake adjustments to the projected inventory balance', () => {
    const material = {
      id: 'material-adjusted',
      nameAr: 'Material',
      nameEn: 'Material',
      productType: 'order',
      unit: 'piece',
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [
        {
          productId: material.id,
          quantity: new Prisma.Decimal(10),
          quantityMultiplier: new Prisma.Decimal(1),
          product: material,
        },
      ],
      sales: [],
      adjustments: [
        { productId: material.id, quantityBase: new Prisma.Decimal(-2) },
        { productId: material.id, quantityBase: new Prisma.Decimal(1) },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        productId: material.id,
        purchasedBaseQuantity: '10',
        consumedBaseQuantity: '0',
        adjustmentBaseQuantity: '-1',
        balanceBaseQuantity: '9',
      }),
    ]);
  });

  it('keeps zero-movement materials available for a complete stocktake', () => {
    const material = {
      id: 'material-zero',
      nameAr: 'Zero material',
      nameEn: 'Zero material',
      productType: 'order',
      unit: 'piece',
    };

    expect(aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [],
      sales: [],
    })).toEqual([
      expect.objectContaining({
        productId: material.id,
        adjustmentBaseQuantity: '0',
        balanceBaseQuantity: '0',
      }),
    ]);
  });

  it('keeps purchase history on the immutable base quantity snapshot', () => {
    const materialWithConversion = (multiplier: string) => ({
      id: 'material-purchase-snapshot',
      nameAr: 'Material',
      nameEn: 'Material',
      productType: 'order',
      unit: 'piece',
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'piece', multiplier },
      ],
    });
    const rowsByConversion = ['64', '999'].map((multiplier) => {
      const material = materialWithConversion(multiplier);
      return aggregateRecipeInventoryStock({
        materialProducts: [material],
        purchases: [{
          productId: material.id,
          quantity: new Prisma.Decimal(2),
          unit: 'carton',
          quantityMultiplier: new Prisma.Decimal(999),
          inventoryBaseQuantitySnapshot: new Prisma.Decimal(128),
          product: material,
        }],
        sales: [],
      });
    });

    for (const rows of rowsByConversion) {
      expect(rows[0]).toEqual(expect.objectContaining({
        purchasedBaseQuantity: '128',
        balanceBaseQuantity: '128',
      }));
    }
  });

  it('keeps sale history on the immutable recipe consumption snapshot', () => {
    const material = {
      id: 'material-sale-snapshot',
      nameAr: 'Material',
      nameEn: 'Material',
      productType: 'order',
      unit: 'piece',
    };
    const soldProduct = {
      id: 'sale-snapshot',
      nameAr: 'Sold product',
      nameEn: 'Sold product',
      productType: 'sale',
      unit: 'piece',
      recipe: [{ materialProductId: material.id, quantity: '999', unit: 'piece' }],
    };

    const rows = aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [],
      sales: [{
        productId: soldProduct.id,
        quantity: new Prisma.Decimal(5),
        unit: 'piece',
        quantityMultiplier: new Prisma.Decimal(1),
        inventoryConsumptionSnapshot: {
          version: 1,
          soldBaseQuantity: '5',
          components: [{
            materialProductId: material.id,
            materialBaseUnit: 'piece',
            quantityBase: '50',
          }],
        },
        product: soldProduct,
      }],
    });

    expect(rows[0]).toEqual(expect.objectContaining({
      consumedBaseQuantity: '50',
      balanceBaseQuantity: '-50',
    }));
  });

  it('rejects malformed inventory consumption snapshots', () => {
    const material = {
      id: 'material-invalid-snapshot',
      nameAr: 'Material',
      nameEn: 'Material',
      productType: 'order',
      unit: 'piece',
    };
    const soldProduct = {
      id: 'sale-invalid-snapshot',
      nameAr: 'Sold product',
      nameEn: 'Sold product',
      productType: 'sale',
      unit: 'piece',
      recipe: [],
    };

    expect(() => aggregateRecipeInventoryStock({
      materialProducts: [material],
      purchases: [],
      sales: [{
        productId: soldProduct.id,
        quantity: new Prisma.Decimal(1),
        inventoryConsumptionSnapshot: { version: 2, components: [] },
        product: soldProduct,
      }],
    })).toThrow('Unsupported inventory consumption snapshot');
  });
});
