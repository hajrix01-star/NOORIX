import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Bootstrap } from '../../../types/api';
import { OrdersV4InventoryTab } from './OrdersV4InventoryTab';

vi.mock('../../../hooks/useUiDir', () => ({ useUiDir: () => 'rtl' }));

vi.mock('../useOrdersV4', () => ({
  useOrdersV4Balances: () => ({ data: [], isLoading: false, error: null }),
  useOrdersV4Ledger: () => ({ data: [], isLoading: false, error: null }),
  useOrdersV4Stocktakes: () => ({ data: [], isLoading: false, error: null }),
  useOrdersV4DataQuality: () => ({ data: { ready: true, errorCount: 0, warningCount: 0, issues: [] }, isLoading: false, error: null }),
  useOrdersV4CutoverAudit: () => ({ data: undefined, isLoading: false, error: null }),
  useCreateOrdersV4Stocktake: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useExecuteOrdersV4Cutover: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const bootstrap = {
  items: [],
  units: [],
  conversions: [],
  sections: [],
  locations: [{
    id: 'location-1',
    code: 'main',
    nameAr: 'المخزون الرئيسي',
    kind: 'central',
    isActive: true,
  }],
} as unknown as OrdersV4Bootstrap;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 900px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('OrdersV4InventoryTab mobile stocktake workflow', () => {
  it('matches the legacy full-height stocktake drawer on mobile', () => {
    render(<OrdersV4InventoryTab companyId="company-1" bootstrap={bootstrap} canWrite />);

    fireEvent.click(screen.getByRole('tab', { name: 'الجرد' }));
    fireEvent.click(screen.getByRole('button', { name: '+ جرد جديد' }));

    const dialog = screen.getByRole('dialog', { name: 'جرد المخزون' });
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-[min(100vw,920px)]');
    expect(dialog.className).not.toContain('max-h-[min(92vh,860px)]');
    expect(screen.queryByLabelText('موقع المخزون')).toBeNull();
    expect(screen.queryByText(/الجرد التشغيلي يعتمد تاريخ اليوم/)).toBeNull();
  });
});
