import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppTestProviders, defaultAppTestContextValue } from '../../../test/appTestProviders';
import ExpenseBatchTable from './ExpenseBatchTable';

const fixtures = vi.hoisted(() => ({
  lines: [
    {
      id: 'line-gosi',
      nameAr: 'GOSI',
      kind: 'fixed_expense',
      categoryId: 'category-gosi',
      supplierId: 'supplier-gosi',
      category: { id: 'category-gosi', nameAr: 'GOSI', account: { taxExempt: false } },
      supplier: { id: 'supplier-gosi', nameAr: 'GOSI', isTaxRegistered: false },
    },
    {
      id: 'line-electricity',
      nameAr: 'كهرباء',
      kind: 'expense',
      categoryId: 'category-electricity',
      supplierId: 'supplier-electricity',
      category: { id: 'category-electricity', nameAr: 'كهرباء', account: { taxExempt: false } },
      supplier: { id: 'supplier-electricity', nameAr: 'الشركة السعودية للكهرباء', isTaxRegistered: true },
    },
  ],
}));

vi.mock('../../../hooks/useApiQuery', () => ({
  useApiListQuery: () => ({ data: fixtures.lines }),
}));

vi.mock('../../../hooks/useVaults', () => ({
  useVaults: () => ({
    paymentVaults: [{
      id: 'vault-bank',
      accountId: 'account-bank',
      nameAr: 'بنك',
      type: 'bank',
      isActive: true,
    }],
  }),
}));

vi.mock('../../../services/api', () => ({
  createInvoiceBatch: vi.fn(),
  getExpenseLines: vi.fn(),
}));

describe('ExpenseBatchTable all-or-nothing validation', () => {
  it('shows full draft totals and blocks partial save until every entered row is complete', async () => {
    render(
      <AppTestProviders
        appValue={{
          ...defaultAppTestContextValue,
          activeCompany: 'company-1',
          activeCompanyId: 'company-1',
          companies: [{ id: 'company-1', nameAr: 'شركة الاختبار', nameEn: null }],
        }}
      >
        <ExpenseBatchTable companyId="company-1" onSaved={() => undefined} />
      </AppTestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'الخزنة' }));
    fireEvent.click(screen.getByRole('option', { name: 'بنك' }));

    fireEvent.click(screen.getByRole('button', { name: 'اسم البند - 1' }));
    fireEvent.click(screen.getByRole('option', { name: 'GOSI (ثابت)' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'الإجمالي - 1' }), { target: { value: '510.11' } });

    fireEvent.click(screen.getByRole('button', { name: 'اسم البند - 2' }));
    fireEvent.click(screen.getByRole('option', { name: 'كهرباء (متغير)' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'الإجمالي - 2' }), { target: { value: '987.38' } });

    const saveButton = screen.getByRole('button', { name: 'حفظ' });
    const supplierInvoiceInput = screen.getByRole('textbox', { name: 'رقم فاتورة المورد - 2' });

    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(supplierInvoiceInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/أكمل 1 صف/)).toBeTruthy();
    expect(screen.getByText('إجمالي المسودة')).toBeTruthy();

    fireEvent.change(supplierInvoiceInput, { target: { value: 'ELEC-2026-08' } });

    await waitFor(() => {
      expect((saveButton as HTMLButtonElement).disabled).toBe(false);
      expect(supplierInvoiceInput.getAttribute('aria-invalid')).toBeNull();
      expect(screen.queryByText(/لن يتم حفظ أي صف بشكل جزئي/)).toBeNull();
    });
  });
});
