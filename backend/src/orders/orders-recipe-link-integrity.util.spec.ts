import { findRecipeLinkIntegrityIssues } from './orders-recipe-link-integrity.util';

const saleProduct = {
  id: 'sale-1',
  nameAr: 'Orange juice',
  recipe: [{ materialProductId: 'orange', quantity: '3', unit: 'piece' }],
};

describe('orders recipe link integrity', () => {
  it('accepts an active inventory material with a valid recipe conversion', () => {
    expect(findRecipeLinkIntegrityIssues({
      material: {
        id: 'orange',
        productType: 'order',
        isActive: true,
        unit: 'piece',
      },
      saleProducts: [saleProduct],
    })).toEqual([]);
  });

  it('accepts a transitive conversion from the recipe unit to stock', () => {
    expect(findRecipeLinkIntegrityIssues({
      material: {
        id: 'orange',
        productType: 'order',
        isActive: true,
        unit: 'piece',
        inventoryConversions: [
          { fromUnit: 'carton', toUnit: 'pack', multiplier: '10' },
          { fromUnit: 'pack', toUnit: 'piece', multiplier: '6' },
        ],
      },
      saleProducts: [{
        ...saleProduct,
        recipe: [{ materialProductId: 'orange', quantity: '1', unit: 'carton' }],
      }],
    })).toEqual([]);
  });

  it('reports a missing conversion after a material definition changes', () => {
    expect(findRecipeLinkIntegrityIssues({
      material: {
        id: 'orange',
        productType: 'order',
        isActive: true,
        unit: 'g',
      },
      saleProducts: [saleProduct],
    })).toEqual([expect.objectContaining({
      saleProductId: 'sale-1',
      reason: 'missing_conversion',
      recipeUnit: 'piece',
      materialBaseUnit: 'g',
    })]);
  });

  it.each([
    [{ isActive: false, productType: 'order' }, 'inactive'],
    [{ isActive: true, productType: 'sale' }, 'not_inventory'],
  ] as const)('reports a material that can no longer be consumed', (change, reason) => {
    expect(findRecipeLinkIntegrityIssues({
      material: { id: 'orange', unit: 'piece', ...change },
      saleProducts: [saleProduct],
    })).toEqual([expect.objectContaining({ reason })]);
  });

  it('ignores recipes that reference another material', () => {
    expect(findRecipeLinkIntegrityIssues({
      material: {
        id: 'sugar',
        productType: 'order',
        isActive: false,
        unit: 'g',
      },
      saleProducts: [saleProduct],
    })).toEqual([]);
  });
});
