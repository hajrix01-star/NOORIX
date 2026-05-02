import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppTestProviders } from '../../test/appTestProviders';
import { useInvoicesListScreen } from './useInvoicesListScreen';

function TestProviders({ children }: any) {
  return <AppTestProviders initialEntries={['/invoices']}>{children}</AppTestProviders>;
}

describe('useInvoicesListScreen', () => {
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
});
