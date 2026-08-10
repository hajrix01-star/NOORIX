import type { LedgerReportingClass } from '../financial-core/financial-reporting-classification.util';

export const CATEGORY_REPORTING_CLASSES = [
  'operating_revenue',
  'operating_purchase',
  'operating_recurring_expense',
  'operating_other_expense',
  'operating_payroll',
] as const;

export type CategoryReportingClass = (typeof CATEGORY_REPORTING_CLASSES)[number];

const RECURRING_CATEGORY_CODES = new Set([
  'EXP-003',
  'E3-1', 'E3-2', 'E3-3', 'E3-4', 'E3-5',
  'E2-1', 'E2-2', 'E2-3', 'E2-4', 'E2-7', 'E2-8', 'E2-10', 'E2-11',
  'E4-2',
]);

export function isCategoryReportingClass(value: unknown): value is CategoryReportingClass {
  return typeof value === 'string' && (CATEGORY_REPORTING_CLASSES as readonly string[]).includes(value);
}

export function isReportingClassCompatibleWithCategoryType(
  type: string | null | undefined,
  reportingClass: CategoryReportingClass,
): boolean {
  if (type === 'purchase') return reportingClass === 'operating_purchase';
  if (type === 'sale') return reportingClass === 'operating_revenue';
  return [
    'operating_recurring_expense',
    'operating_other_expense',
    'operating_payroll',
  ].includes(reportingClass);
}
export function defaultCategoryReportingClass(type: string | null | undefined): CategoryReportingClass {
  if (type === 'purchase') return 'operating_purchase';
  if (type === 'sale') return 'operating_revenue';
  return 'operating_other_expense';
}

/**
 * Deterministic defaults for the shared accounting tree. Custom categories use
 * their explicit selection, or the safe default for their category type.
 */
export function reportingClassForCategorySeed(
  code: string | null | undefined,
  type: string | null | undefined,
): CategoryReportingClass {
  const normalized = String(code ?? '').toUpperCase();
  if (normalized === 'EXP-004') return 'operating_payroll';
  if (RECURRING_CATEGORY_CODES.has(normalized)) return 'operating_recurring_expense';
  return defaultCategoryReportingClass(type);
}

export function asLedgerReportingClass(value: CategoryReportingClass): LedgerReportingClass {
  return value;
}