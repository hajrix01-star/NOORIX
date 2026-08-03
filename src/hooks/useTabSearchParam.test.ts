import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { pickTabFromSearchParams, useTabSearchParam } from './useTabSearchParam';

const INVENTORY_TABS = ['upload', 'review', 'invoices', 'suppliers', 'items', 'alerts', 'purchases'];

describe('pickTabFromSearchParams (screen-specific + legacy tab)', () => {
  it('prefers screen-specific tab when set', () => {
    const sp = new URLSearchParams('inventoryTab=review&tab=history');
    expect(pickTabFromSearchParams(sp, INVENTORY_TABS, 'upload', 'inventoryTab', 'tab')).toBe('review');
  });

  it('ignores stale tab=history from other screens', () => {
    const sp = new URLSearchParams('tab=history');
    expect(pickTabFromSearchParams(sp, INVENTORY_TABS, 'upload', 'inventoryTab', 'tab')).toBe('upload');
  });

  it('accepts legacy tab=review when screen-specific tab absent', () => {
    const sp = new URLSearchParams('tab=review');
    expect(pickTabFromSearchParams(sp, INVENTORY_TABS, 'upload', 'inventoryTab', 'tab')).toBe('review');
  });

  it('falls back to default when empty', () => {
    const sp = new URLSearchParams('');
    expect(pickTabFromSearchParams(sp, INVENTORY_TABS, 'upload', 'inventoryTab', 'tab')).toBe('upload');
  });

  it('resolves tab aliases to allowed ids', () => {
    const sp = new URLSearchParams('tab=sales');
    const ids = ['orders', 'sales-report'];
    expect(pickTabFromSearchParams(sp, ids, 'orders', 'tab', null, { sales: 'sales-report' })).toBe('sales-report');
  });
});

describe('pickTabFromSearchParams (Orders screen-specific key)', () => {
  const ORDER_TABS = ['staff-sales', 'orders', 'sales-report'] as const;

  it('prefers ordersTab over stale tab from other screens', () => {
    const sp = new URLSearchParams('ordersTab=sales-report&tab=overview');
    expect(pickTabFromSearchParams(sp, ORDER_TABS, 'staff-sales', 'ordersTab', 'tab')).toBe('sales-report');
  });

  it('falls back to legacy tab when ordersTab absent', () => {
    const sp = new URLSearchParams('tab=sales-report');
    expect(pickTabFromSearchParams(sp, ORDER_TABS, 'staff-sales', 'ordersTab', 'tab')).toBe('sales-report');
  });
});

describe('useTabSearchParam navigation responsiveness', () => {
  it('switches the visible parent tab immediately while a report sub-tab param coexists', () => {
    const wrapper = ({ children }: { children: ReactNode }) => React.createElement(
      MemoryRouter,
      { initialEntries: ['/orders-v4?ordersV4Tab=reports&ordersV4ReportTab=items'] },
      children,
    );
    const { result } = renderHook(() => {
      const [activeTab, setActiveTab] = useTabSearchParam(
        ['requests', 'registration', 'reports', 'catalog', 'inventory'],
        'requests',
        'ordersV4Tab',
        'tab',
        undefined,
        { persistDefault: true },
      );
      const [reportTab] = useTabSearchParam(['items', 'registration'], 'items', 'ordersV4ReportTab');
      return { activeTab, setActiveTab, reportTab, search: useLocation().search };
    }, { wrapper });

    act(() => result.current.setActiveTab('catalog'));

    expect(result.current.activeTab).toBe('catalog');
    expect(result.current.reportTab).toBe('items');
    expect(result.current.search).toContain('ordersV4Tab=catalog');
  });
});
