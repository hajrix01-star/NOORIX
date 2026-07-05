import { describe, expect, it } from 'vitest';
import {
  buildInvoiceCreatorFilterOptions,
  buildInvoiceKindFilterOptions,
  buildInvoiceSupplierCategoryFilterOptions,
  buildInvoiceSupplierFilterOptions,
  buildInvoiceVaultFilterOptions,
} from './invoicesListFilterModel';

const labels: Record<string, string> = {
  categoryTypes: 'Purchase',
  categoryTypeExpense: 'Expense',
  fixedExpenseType: 'Fixed expense',
  invoiceKindHrExpense: 'HR expense',
  totalSalary: 'Salary',
  quickAdvance: 'Advance',
  categoryTypeSale: 'Sale',
  invoicesFilterCreatorUnrecorded: 'Unrecorded',
};

const t = (key: string) => labels[key] || key;

describe('invoicesListFilterModel', () => {
  it('builds invoice kind options and gates sales by permission flag', () => {
    const withoutSales = buildInvoiceKindFilterOptions(t, false);
    const withSales = buildInvoiceKindFilterOptions(t, true);

    expect(withoutSales.map((option) => option.value)).toEqual([
      'purchase',
      'expense',
      'fixed_expense',
      'hr_expense',
      'salary',
      'advance',
    ]);
    expect(withSales.map((option) => option.value)).toContain('sale');
    expect(withSales.find((option) => option.value === 'sale')?.label).toBe('Sale');
  });

  it('builds supplier and category options with localized fallback names', () => {
    const suppliers = buildInvoiceSupplierFilterOptions(
      [
        { id: 's1', nameAr: 'Arabic supplier', nameEn: 'English supplier' },
        { id: 's2', nameEn: 'English only' },
        { id: '', nameAr: 'Ignored' },
      ],
      'ar',
    );
    const categories = buildInvoiceSupplierCategoryFilterOptions(
      [{ id: 'c1', nameAr: '', nameEn: 'Maintenance' }],
      'ar',
    );

    expect(suppliers).toEqual([
      { value: 's1', label: 'Arabic supplier' },
      { value: 's2', label: 'English only' },
    ]);
    expect(categories).toEqual([{ value: 'c1', label: 'Maintenance' }]);
  });

  it('prepends the unrecorded creator option and falls back to email', () => {
    const options = buildInvoiceCreatorFilterOptions(
      [
        { id: 'u1', nameAr: '', nameEn: '', email: 'user@example.com' },
        { id: 'u2', nameAr: 'Arabic user' },
      ],
      'en',
      t,
    );

    expect(options[0]).toEqual({ value: '__none__', label: 'Unrecorded' });
    expect(options[1]).toEqual({ value: 'u1', label: 'user@example.com' });
    expect(options[2]).toEqual({ value: 'u2', label: 'Arabic user' });
  });

  it('builds vault options through the central vault display helper', () => {
    const options = buildInvoiceVaultFilterOptions(
      [
        { id: 'v1', nameAr: 'Arabic vault', nameEn: 'Vault', type: 'cash' },
        { id: 'v2', name: 'Fallback vault' },
      ],
      'en',
    );

    expect(options[0]).toEqual({ value: 'v1', label: 'Vault' });
    expect(options[1]).toEqual({ value: 'v2', label: 'Fallback vault' });
  });
});
