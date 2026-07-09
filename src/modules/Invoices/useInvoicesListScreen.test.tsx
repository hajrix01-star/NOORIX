import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { AppTestProviders, defaultAppTestContextValue } from '../../test/appTestProviders';
import { useInvoices } from '../../hooks/useInvoices';
import { useInvoicesListScreen } from './useInvoicesListScreen';

vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(() => ({
    items: [],
    total: 0,
    sums: {
      all: { count: 0, net: '0', tax: '0', total: '0' },
      inflow: { count: 0, net: '0', tax: '0', total: '0' },
      outflow: { count: 0, net: '0', tax: '0', total: '0' },
    },
    sumsByKind: [],
    inflowByVault: [],
    outflowSummary: { purchasesTotal: '0', expensesTotal: '0', taxTotal: '0' },
    isLoading: false,
    isFetching: false,
    isPlaceholderData: false,
    isError: false,
    error: null,
  })),
}));

vi.mock('../../hooks/useApiQuery', () => ({
  useApiQuery: vi.fn(() => ({ data: { users: [] } })),
}));

vi.mock('../../hooks/useSuppliers', () => ({
  useSuppliers: vi.fn(() => ({ suppliers: [] })),
}));

vi.mock('../../hooks/useCategories', () => ({
  useCategories: vi.fn(() => ({ flatCategories: [] })),
}));

vi.mock('../../hooks/useVaults', () => ({
  useVaults: vi.fn(() => ({ vaultsList: [], paymentVaults: [] })),
}));

const mockedUseInvoices = vi.mocked(useInvoices);

function TestProviders({ children, withCompany = false }: { children: ReactNode; withCompany?: boolean }) {
  return (
    <AppTestProviders
      initialEntries={['/invoices']}
      appValue={
        withCompany
          ? {
              ...defaultAppTestContextValue,
              activeCompany: 'company-1',
              activeCompanyId: 'company-1',
              companies: [{ id: 'company-1', nameAr: 'شركة', nameEn: 'Company' }],
              hasRealCompanies: true,
            }
          : defaultAppTestContextValue
      }
    >
      {children}
    </AppTestProviders>
  );
}

describe('useInvoicesListScreen', () => {
  beforeEach(() => {
    mockedUseInvoices.mockClear();
  });

  it('exposes list state with no company (queries idle)', () => {
    const { result } = renderHook(() => useInvoicesListScreen(), { wrapper: TestProviders });
    expect(result.current.companyId).toBe('');
    expect(typeof result.current.toggleSort).toBe('function');
    expect(typeof result.current.handlePrintCashReport).toBe('function');
    expect(result.current.sortKey).toBe('transactionDate');
    expect(result.current.sortDir).toBe('desc');
  });

  it('toggleSort switches column and flips direction on same column', () => {
    const { result } = renderHook(() => useInvoicesListScreen(), { wrapper: TestProviders });
    act(() => {
      result.current.toggleSort('totalAmount');
    });
    expect(result.current.sortKey).toBe('totalAmount');
    expect(result.current.sortDir).toBe('desc');

    act(() => {
      result.current.toggleSort('totalAmount');
    });
    expect(result.current.sortKey).toBe('totalAmount');
    expect(result.current.sortDir).toBe('asc');
  });

  it('updates visible table rows when the cancelled invoices toggle changes', () => {
    mockedUseInvoices.mockReturnValue({
      items: [
        { id: 'active-1', status: 'active', kind: 'purchase' },
        { id: 'cancelled-1', status: 'cancelled', kind: 'purchase' },
      ],
      total: 2,
      sums: {
        all: { count: 2, net: '0', tax: '0', total: '0' },
        inflow: { count: 0, net: '0', tax: '0', total: '0' },
        outflow: { count: 2, net: '0', tax: '0', total: '0' },
      },
      sumsByKind: [],
      inflowByVault: [],
      outflowSummary: { purchasesTotal: '0', expensesTotal: '0', taxTotal: '0' },
      isLoading: false,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
      error: null,
    });

    const { result } = renderHook(() => useInvoicesListScreen(), {
      wrapper: ({ children }) => <TestProviders withCompany>{children}</TestProviders>,
    });

    expect(result.current.tableData.map((row) => row.id)).toEqual(['active-1']);

    act(() => {
      result.current.setShowCancelled(true);
    });

    expect(result.current.tableData.map((row) => row.id)).toEqual(['active-1', 'cancelled-1']);
    expect(mockedUseInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ includeCancelled: true }));
  });
});
