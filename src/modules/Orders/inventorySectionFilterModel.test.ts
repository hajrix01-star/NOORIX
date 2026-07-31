import { describe, expect, it } from 'vitest';
import type { OrderRecipeInventoryStockRow, OrderSection } from '../../types/api';
import {
  ALL_INVENTORY_SECTIONS,
  UNCATEGORIZED_INVENTORY_SECTION,
  buildInventorySectionOptions,
  inventoryRowMatchesSection,
} from './inventorySectionFilterModel';

const sections: OrderSection[] = [
  { id: 'bar-primary', companyId: 'company-1', nameAr: 'بار', nameEn: 'Bar', sortOrder: 0 },
  { id: 'bar-duplicate', companyId: 'company-1', nameAr: ' بار ', nameEn: 'Bar duplicate', sortOrder: 1 },
];

function stockRow(
  productId: string,
  sectionIds: string[],
  sectionNames: string[],
): OrderRecipeInventoryStockRow {
  return {
    productId,
    productNameAr: productId,
    productNameEn: null,
    sections: sectionNames,
    sectionIds,
    unit: 'حبة',
    purchasedBaseQuantity: '0',
    consumedBaseQuantity: '0',
    adjustmentBaseQuantity: '0',
    balanceBaseQuantity: '0',
  };
}

describe('inventory section filter model', () => {
  it('groups duplicate section ids under one visible filter', () => {
    const rows = [
      stockRow('first', ['bar-primary'], ['بار']),
      stockRow('second', ['bar-duplicate'], [' بار ']),
    ];

    const options = buildInventorySectionOptions(rows, sections);

    expect(options).toHaveLength(2);
    expect(options[0]).toEqual({ id: ALL_INVENTORY_SECTIONS, label: 'كل الأقسام', count: 2 });
    expect(options[1]).toMatchObject({ label: 'بار', count: 2 });
    expect(rows.every((row) => inventoryRowMatchesSection(row, options[1].id, sections))).toBe(true);
  });

  it('keeps uncategorized inventory separate', () => {
    const row = stockRow('uncategorized', [], []);
    const options = buildInventorySectionOptions([row], sections);

    expect(options).toContainEqual({
      id: UNCATEGORIZED_INVENTORY_SECTION,
      label: 'بدون قسم',
      count: 1,
    });
    expect(inventoryRowMatchesSection(row, UNCATEGORIZED_INVENTORY_SECTION, sections)).toBe(true);
  });
});
