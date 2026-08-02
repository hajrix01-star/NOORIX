import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Item, OrdersV4Unit } from '../../../types/api';
import { OrdersV4DocumentLineModal } from './OrdersV4DocumentLineModal';

afterEach(cleanup);

const piece: OrdersV4Unit = {
  id: 'unit-piece',
  code: 'piece',
  nameAr: 'حبة',
  dimension: 'count',
  decimalScale: 0,
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
});
