import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Item, OrdersV4Unit } from '../../../types/api';
import { OrdersV4DocumentLineModal } from './OrdersV4DocumentLineModal';

vi.mock('../../../i18n/useTranslation', async () => {
  const translations = await vi.importActual<typeof import('../../../i18n/translations')>('../../../i18n/translations');
  return { useTranslation: () => ({ lang: 'ar', t: (key: string) => translations.getText(key, 'ar') }) };
});

afterEach(cleanup);

const piece: OrdersV4Unit = {
  id: 'unit-piece',
  code: 'piece',
  nameAr: 'حبة',
  dimension: 'count',
  decimalScale: 3,
  isActive: true,
};

const item: OrdersV4Item = {
  id: 'item-1',
  nameAr: 'أظرف سكر أبيض',
  itemType: 'purchased',
  inventoryUnitId: piece.id,
  inventoryUnit: piece,
  units: [{
    id: 'item-unit-1',
    unitId: piece.id,
    unit: piece,
    purchaseLabel: 'ظرف',
    isOrderEnabled: true,
    lastPrice: '40',
    isActive: true,
    sortOrder: 0,
  }],
  trackInventory: true,
  isActive: true,
  sections: [],
};

describe('OrdersV4DocumentLineModal', () => {
  it('collects the unit, quantity, and price before adding the item', () => {
    const onConfirm = vi.fn();
    render(
      <OrdersV4DocumentLineModal
        item={item}
        isPurchase
        isReceiving={false}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'ظرف - 40 ر.س' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }));

    expect(onConfirm).toHaveBeenCalledWith({
      itemId: item.id,
      quantity: '2',
      unitId: piece.id,
      unitPrice: '40',
      priceUnitId: piece.id,
    });
  });

  it('requires and returns multiple reasons for an independently cancelled item', () => {
    const onConfirm = vi.fn();
    render(
      <OrdersV4DocumentLineModal
        item={item}
        isPurchase={false}
        isReceiving={false}
        isCancellation
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    );

    const add = screen.getByRole('button', { name: 'إضافة الإلغاء' });
    expect(add).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'خطأ في الطلب' }));
    fireEvent.click(screen.getByRole('button', { name: 'طلب مكرر' }));
    fireEvent.click(add);

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      itemId: item.id,
      quantity: '1',
      cancellationReasons: ['order_error', 'duplicate_order'],
    }));
  });
});
