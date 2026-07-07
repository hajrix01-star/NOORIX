import { describe, expect, it } from 'vitest';
import {
  WEEKLY_SHEET_DAY_COUNT,
  WEEKLY_SHEET_TOTAL_COLS,
  buildItemsCatalogWeeklyPrintHtml,
  buildItemsCatalogWeeklyPdfFilename,
} from './itemsCatalogWeeklyPrint';

const t = (key: string) => {
  const map: Record<string, string> = {
    category: 'Category',
    productNameAr: 'Product',
    ordersPrintCatalogSpec: 'Spec',
    ordersPrintWeeklyStock: 'Stock',
    ordersPrintWeeklyOrder: 'Order',
    ordersPrintWeeklyWeekFrom: 'Week from',
    ordersPrintWeeklyWeekTo: 'To',
    ordersPrintWeeklyFillHint: 'Hint',
  };
  return map[key] || key;
};

describe('buildItemsCatalogWeeklyPrintHtml', () => {
  it('renders 7 stock and 7 order day columns without notes', () => {
    const html = buildItemsCatalogWeeklyPrintHtml(
      [{
        categoryId: 'c1',
        categoryName: 'Meat',
        products: [{ id: 'p1', nameAr: 'Chicken', nameEn: '', unit: 'piece' }],
      }],
      t,
      (unit) => unit,
      true,
    );

    expect(html).toContain(`colspan="${WEEKLY_SHEET_DAY_COUNT}"`);
    expect(html).toContain('Stock');
    expect(html).toContain('Order');
    expect(html).not.toContain('Notes');
    expect((html.match(/<th class="col-day">/g) || []).length).toBe(WEEKLY_SHEET_DAY_COUNT * 2);
    expect((html.match(/class="col-day"><\/td>/g) || []).length).toBe(WEEKLY_SHEET_DAY_COUNT * 2);
    expect(html).toContain(`colspan="${WEEKLY_SHEET_TOTAL_COLS}"`);
  });
});

describe('buildItemsCatalogWeeklyPdfFilename', () => {
  it('uses weekly prefix', () => {
    const name = buildItemsCatalogWeeklyPdfFilename(
      { section: 'Kitchen', categoryId: '', productType: 'order' },
      [],
      [{ id: 's1', nameAr: 'Kitchen' }],
    );
    expect(name).toMatch(/^items-weekly-order-kitchen-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
