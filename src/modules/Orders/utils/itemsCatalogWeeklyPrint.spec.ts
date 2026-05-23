import { describe, expect, it } from 'vitest';
import {
  WEEKLY_SHEET_DAY_COUNT,
  WEEKLY_SHEET_TOTAL_COLS,
  buildItemsCatalogWeeklyPrintHtml,
  buildItemsCatalogWeeklyPdfFilename,
} from './itemsCatalogWeeklyPrint';

const t = (key: string) => {
  const map: Record<string, string> = {
    category: 'الفئة',
    productNameAr: 'الصنف',
    ordersPrintCatalogSpec: 'المواصفات',
    ordersPrintWeeklyStock: 'الموجود',
    ordersPrintWeeklyOrder: 'المطلوب',
    ordersPrintWeeklyWeekFrom: 'أسبوع من',
    ordersPrintWeeklyWeekTo: 'إلى',
    ordersPrintWeeklyFillHint: 'تلميح',
  };
  return map[key] || key;
};

describe('buildItemsCatalogWeeklyPrintHtml', () => {
  it('renders 7 stock and 7 order day columns without notes', () => {
    const html = buildItemsCatalogWeeklyPrintHtml(
      [{
        categoryId: 'c1',
        categoryName: 'لحوم',
        products: [{ nameAr: 'دجاج', nameEn: '', unit: 'piece' }],
      }],
      t,
      (u) => u,
      true,
    );

    expect(html).toContain(`colspan="${WEEKLY_SHEET_DAY_COUNT}"`);
    expect(html).toContain('الموجود');
    expect(html).toContain('المطلوب');
    expect(html).not.toContain('ملاحظات');
    expect((html.match(/<th class="col-day">/g) || []).length).toBe(WEEKLY_SHEET_DAY_COUNT * 2);
    expect((html.match(/class="col-day"><\/td>/g) || []).length).toBe(WEEKLY_SHEET_DAY_COUNT * 2);
    expect(html).toContain(`colspan="${WEEKLY_SHEET_TOTAL_COLS}"`);
  });
});

describe('buildItemsCatalogWeeklyPdfFilename', () => {
  it('uses weekly prefix', () => {
    const name = buildItemsCatalogWeeklyPdfFilename(
      { section: 'مطبخ', categoryId: '', productType: 'order' },
      [],
      [{ id: 's1', nameAr: 'مطبخ' }],
    );
    expect(name).toMatch(/^items-weekly-order-مطبخ-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
