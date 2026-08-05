import { ordersV4NormalizedSearch, ordersV4ReportFiltersFromQuery } from './orders-v4-report-filters.util';

describe('Orders V4 report filters', () => {
  it('deduplicates CSV identifiers and rejects unsupported enumerated values', () => {
    expect(ordersV4ReportFiltersFromQuery({
      sectionIds: 'bar, kitchen,bar',
      paymentMethods: 'cash,invalid,custody',
      statuses: 'received,unknown',
      cancellationReasons: 'operational_reason,employee_meal,hospitality,invalid',
      search: '  سكر  ',
    })).toMatchObject({
      sectionIds: ['bar', 'kitchen'],
      paymentMethods: ['cash', 'custody'],
      statuses: ['received'],
      cancellationReasons: ['operational_reason', 'employee_meal', 'hospitality'],
      search: 'سكر',
    });
  });

  it('normalizes Arabic spelling and diacritics for stable search', () => {
    expect(ordersV4NormalizedSearch('إِلَى')).toBe(ordersV4NormalizedSearch('الى'));
    expect(ordersV4NormalizedSearch('فئة')).toBe(ordersV4NormalizedSearch('فئه'));
  });
});
