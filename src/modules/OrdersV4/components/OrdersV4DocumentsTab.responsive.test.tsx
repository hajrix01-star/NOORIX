import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Bootstrap, OrdersV4Item } from '../../../types/api';
import { OrdersV4DocumentLinesTable } from './OrdersV4DocumentLinesTable';
import { OrdersV4DocumentsTab } from './OrdersV4DocumentsTab';

vi.mock('../../../i18n/useTranslation', async () => {
  const translations = await vi.importActual<typeof import('../../../i18n/translations')>('../../../i18n/translations');
  return { useTranslation: () => ({ lang: 'ar', t: (key: string) => translations.getText(key, 'ar') }) };
});

vi.mock('../useOrdersV4', () => ({
  useOrdersV4Documents: () => ({ data: [], isLoading: false, error: null }),
  useOrdersV4Summary: () => ({ data: undefined }),
  useCreateOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReceiveOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useReverseOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUndoReverseOrdersV4Document: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const bootstrap = {
  items: [],
  units: [],
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

describe('OrdersV4DocumentsTab mobile document workflow', () => {
  it('renders the purchase period summary as cards rather than a table', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="purchase"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
      />,
    );

    const summaryCards = screen.getByTestId('orders-v4-purchase-summary-cards');
    expect(summaryCards.querySelectorAll('article')).toHaveLength(2);
    expect(summaryCards.querySelector('table')).toBeNull();
  });

  it.each([
    ['purchase', '+ طلب جديد', 'طلب شراء جديد — طلبات V4'],
    ['registration', '+ تسجيل جديد', 'تسجيل داخلي جديد — طلبات V4'],
  ] as const)('opens %s creation as a full-height adaptive sheet on mobile', (documentType, triggerLabel, title) => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType={documentType}
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        canCreate
      />,
    );

    const trigger = screen.getByRole('button', { name: triggerLabel });
    const toolbar = screen.getByRole('toolbar', { name: documentType === 'purchase' ? 'إجراءات الطلبات' : 'إجراءات التسجيل الداخلي' });
    expect(toolbar.contains(trigger)).toBe(true);
    expect(trigger.closest('section')).toBeNull();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: title });
    expect(dialog.className).toContain('h-full');
    expect(dialog.className).toContain('w-[min(100vw,920px)]');
    expect(dialog.className).not.toContain('max-h-[min(92vh,860px)]');
    expect(screen.queryByLabelText('موقع المخزون')).toBeNull();
  });

  it('renders added document lines as one editable table without repeated field headings', () => {
    const item = {
      id: 'item-1',
      sku: 'M-1',
      nameAr: 'معسل',
      itemType: 'purchased',
      inventoryUnitId: 'unit-1',
      inventoryUnit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
      units: [{
        id: 'item-unit-1',
        unitId: 'unit-1',
        unit: { id: 'unit-1', code: 'box', nameAr: 'علبة', dimension: 'count', decimalScale: 3, isActive: true },
        isOrderEnabled: true,
        isActive: true,
        sortOrder: 0,
        lastPrice: '15',
      }],
      trackInventory: true,
      isActive: true,
      sections: [],
    } as unknown as OrdersV4Item;
    const onPatch = vi.fn();
    const onRemove = vi.fn();

    render(
      <OrdersV4DocumentLinesTable
        lines={[
          { key: 'line-1', itemId: item.id, quantity: '1', unitId: 'unit-1', unitPrice: '15', priceUnitId: 'unit-1' },
          { key: 'line-2', itemId: item.id, quantity: '2', unitId: 'unit-1', unitPrice: '15', priceUnitId: 'unit-1' },
        ]}
        items={[item]}
        isPurchase
        isReceiving={false}
        onPatch={onPatch}
        onRemove={onRemove}
      />,
    );

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'الصنف',
      'الكمية',
      'وحدة الإدخال',
      'سعر الوحدة',
      'وحدة السعر',
      'الإجراء',
    ]);
    expect(screen.getAllByText('الكمية')).toHaveLength(1);
    fireEvent.change(screen.getAllByRole('spinbutton', { name: 'كمية معسل' })[0], { target: { value: '3' } });
    expect(onPatch).toHaveBeenCalledWith('line-1', { quantity: '3' });
    fireEvent.click(screen.getAllByRole('button', { name: 'حذف معسل' })[1]);
    expect(onRemove).toHaveBeenCalledWith('line-2');
  });

  it('opens cancellation through the same internal-registration sheet', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-08-01"
        endDate="2026-08-31"
        bootstrap={bootstrap}
        canCreate
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل إلغاء' }));
    expect(screen.getByRole('dialog', { name: 'تسجيل إلغاء — طلبات V4' })).toBeTruthy();
    expect(screen.getByText(/لا يرتبط السجل بتسجيل سابق/)).toBeTruthy();
  });

  it('hides internal-registration overview cards for a submit-only employee', () => {
    render(
      <OrdersV4DocumentsTab
        companyId="company-1"
        documentType="registration"
        startDate="2026-07-28"
        endDate="2026-08-03"
        bootstrap={bootstrap}
        canCreate
        canReport={false}
        showOverviewCards={false}
        historyWindowDays={7}
      />,
    );

    expect(screen.queryByText('عدد التسجيلات')).toBeNull();
    expect(screen.getByText(/تسجيلاته الداخلية لآخر 7 أيام فقط/)).toBeTruthy();
  });
});
