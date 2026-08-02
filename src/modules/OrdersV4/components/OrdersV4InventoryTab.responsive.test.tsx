import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Bootstrap } from '../../../types/api';
import { OrdersV4InventoryTab } from './OrdersV4InventoryTab';

const inventoryFixtures = vi.hoisted(() => ({ balances: [] as unknown[] }));

vi.mock('../../../hooks/useUiDir', () => ({ useUiDir: () => 'rtl' }));

vi.mock('../useOrdersV4', () => ({
  useOrdersV4Balances: () => ({ data: inventoryFixtures.balances, isLoading: false, error: null }),
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
  inventoryFixtures.balances = [];
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

  it('uses compact legacy-style item cards while preserving centralized packaging entry', () => {
    const unit = { id: 'unit-1', code: 'piece', nameAr: 'حبة', nameEn: 'Piece', dimension: 'count', decimalScale: 3, isActive: true };
    const populatedBootstrap = {
      ...bootstrap,
      units: [unit],
      items: [{
        id: 'item-1',
        nameAr: 'آيس كريم فانيلا',
        nameEn: 'Vanilla Ice Cream',
        itemType: 'purchased',
        inventoryUnitId: unit.id,
        inventoryUnit: unit,
        units: [{ id: 'item-unit-1', unitId: unit.id, unit, isOrderEnabled: true, isActive: true, sortOrder: 0 }],
        trackInventory: true,
        isActive: true,
        sections: [],
      }],
    } as unknown as OrdersV4Bootstrap;
    inventoryFixtures.balances = [{
      itemId: 'item-1',
      itemName: 'آيس كريم فانيلا',
      categoryName: 'مجمدات',
      unitCode: 'piece',
      unitName: 'حبة',
      locationId: 'location-1',
      locationName: 'المخزون الرئيسي',
      quantity: '10',
      value: '100',
      averageUnitCost: '10',
      lastSequence: '1',
      updatedAt: '2026-08-03T00:00:00.000Z',
    }];

    render(<OrdersV4InventoryTab companyId="company-1" bootstrap={populatedBootstrap} canWrite />);
    fireEvent.click(screen.getByRole('tab', { name: 'الجرد' }));
    fireEvent.click(screen.getByRole('button', { name: '+ جرد جديد' }));

    expect(screen.getByTestId('orders-v4-stocktake-items').className).toContain('md:grid-cols-2');
    expect(screen.getByTestId('orders-v4-stocktake-quantity-pair').className).toContain('grid-cols-2');
    expect(screen.getByTestId('orders-v4-stocktake-variance').className).toContain('py-1.5');
    expect(screen.getByDisplayValue('10')).toBeTruthy();
    expect((screen.getByTestId('orders-v4-stocktake-notes') as HTMLDetailsElement).open).toBe(false);
  });
});
