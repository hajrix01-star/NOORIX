import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { ToastProvider } from '../../context/ToastContext';
import { useInvoicesListScreen } from './useInvoicesListScreen';

const noop = () => {};

const appValue = {
  activeCompany: null,
  activeCompanyId: '',
  setActiveCompany: noop,
  companies: [],
  hasRealCompanies: false,
  cardStyle: 'default',
  setCardStyle: noop,
  language: 'ar',
  setLanguage: noop,
  isSidebarOpen: false,
  setSidebarOpen: noop,
  user: { role: 'admin' },
  userRole: 'admin',
  userPermissions: [],
};

function TestProviders({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/invoices']}>
        <AppContext.Provider value={appValue}>
          <ToastProvider>{children}</ToastProvider>
        </AppContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useInvoicesListScreen', () => {
  it('exposes list state with no company (queries idle)', () => {
    const { result } = renderHook(() => useInvoicesListScreen(), { wrapper: TestProviders });
    expect(result.current.companyId).toBe('');
    expect(typeof result.current.toggleSort).toBe('function');
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
});
