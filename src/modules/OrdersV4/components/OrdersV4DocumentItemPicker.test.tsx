import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Item, OrdersV4Section, OrdersV4Unit } from '../../../types/api';
import { OrdersV4DocumentItemPicker, filterOrdersV4DocumentItems } from './OrdersV4DocumentItemPicker';

afterEach(cleanup);

const unit: OrdersV4Unit = {
  id: 'unit-1',
  code: 'piece',
  nameAr: 'حبة',
  dimension: 'count',
  decimalScale: 3,
  isActive: true,
};

const kitchen: OrdersV4Section = { id: 'section-1', code: 'kitchen', nameAr: 'المطبخ', isActive: true };
const drinks: OrdersV4Section = { id: 'section-2', code: 'drinks', nameAr: 'المشروبات', isActive: true };

const items: OrdersV4Item[] = [
  {
    id: 'item-1',
    sku: 'POT-01',
    nameAr: 'بطاطس',
    itemType: 'purchased',
    inventoryUnitId: unit.id,
    inventoryUnit: unit,
    units: [{ id: 'iu-1', unitId: unit.id, unit, isOrderEnabled: true, isActive: true, sortOrder: 0 }],
    category: { id: 'category-1', nameAr: 'خضار', isActive: true },
    trackInventory: true,
    isActive: true,
    sections: [{ section: kitchen }],
  },
  {
    id: 'item-2',
    sku: 'COLA-01',
    nameAr: 'كولا',
    itemType: 'sale',
    inventoryUnitId: unit.id,
    inventoryUnit: unit,
    units: [{ id: 'iu-2', unitId: unit.id, unit, isOrderEnabled: true, isActive: true, sortOrder: 0 }],
    category: { id: 'category-2', nameAr: 'مشروبات غازية', isActive: true },
    trackInventory: true,
    isActive: true,
    sections: [{ section: drinks }],
  },
];

describe('OrdersV4DocumentItemPicker', () => {
  it('filters by section, item text, SKU, and category', () => {
    expect(filterOrdersV4DocumentItems(items, kitchen.id, '')).toEqual([items[0]]);
    expect(filterOrdersV4DocumentItems(items, '', 'COLA')).toEqual([items[1]]);
    expect(filterOrdersV4DocumentItems(items, '', 'غازية')).toEqual([items[1]]);
  });

  it('renders products as POS buttons and selects by click', () => {
    const onSelect = vi.fn();
    render(
      <OrdersV4DocumentItemPicker
        items={items}
        sections={[kitchen, drinks]}
        selectedQuantities={new Map([['item-1', 2]])}
        onSelect={onSelect}
      />,
    );

    const potatoes = screen.getByRole('button', { name: /بطاطس/ });
    expect(potatoes.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(potatoes);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('supports the section buttons and search field', () => {
    render(
      <OrdersV4DocumentItemPicker
        items={items}
        sections={[kitchen, drinks]}
        selectedQuantities={new Map()}
        onSelect={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'المشروبات' }));
    expect(screen.queryByRole('button', { name: /بطاطس/ })).toBeNull();
    expect(screen.getByRole('button', { name: /كولا/ })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('ابحث باسم الصنف أو الكود أو الفئة…'), { target: { value: 'غير موجود' } });
    expect(screen.getByText('لا توجد أصناف مطابقة للبحث.')).toBeTruthy();
  });
});
