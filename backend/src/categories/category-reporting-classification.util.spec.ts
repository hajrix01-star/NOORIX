import {
  defaultCategoryReportingClass,
  isCategoryReportingClass,
  isReportingClassCompatibleWithCategoryType,
  reportingClassForCategorySeed,
} from './category-reporting-classification.util';

describe('category reporting classification', () => {
  it('maps the shared accounting tree deterministically', () => {
    expect(reportingClassForCategorySeed('PUR-001', 'purchase')).toBe('operating_purchase');
    expect(reportingClassForCategorySeed('REV-001', 'sale')).toBe('operating_revenue');
    expect(reportingClassForCategorySeed('EXP-004', 'expense')).toBe('operating_payroll');
    expect(reportingClassForCategorySeed('E9-1', 'expense')).toBe('operating_other_expense');
    expect(reportingClassForCategorySeed('E9-2', 'expense')).toBe('operating_recurring_expense');
    expect(reportingClassForCategorySeed('E9-3', 'expense')).toBe('operating_recurring_expense');
    expect(reportingClassForCategorySeed('E3-2', 'expense')).toBe('operating_recurring_expense');
  });

  it('uses a safe type default for custom categories', () => {
    expect(defaultCategoryReportingClass('purchase')).toBe('operating_purchase');
    expect(defaultCategoryReportingClass('sale')).toBe('operating_revenue');
    expect(defaultCategoryReportingClass('expense')).toBe('operating_other_expense');
  });

  it('keeps classification compatible with the category type', () => {
    expect(isReportingClassCompatibleWithCategoryType('purchase', 'operating_purchase')).toBe(true);
    expect(isReportingClassCompatibleWithCategoryType('expense', 'operating_payroll')).toBe(true);
    expect(isReportingClassCompatibleWithCategoryType('expense', 'operating_revenue')).toBe(false);
    expect(isReportingClassCompatibleWithCategoryType('sale', 'operating_other_expense')).toBe(false);
  });
  it('accepts only operating category classes', () => {
    expect(isCategoryReportingClass('operating_payroll')).toBe(true);
    expect(isCategoryReportingClass('non_operating_loan')).toBe(false);
    expect(isCategoryReportingClass('unclassified')).toBe(false);
  });
});
