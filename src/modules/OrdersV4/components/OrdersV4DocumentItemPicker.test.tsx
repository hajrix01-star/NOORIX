import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrdersV4Item, OrdersV4Section, OrdersV4Unit } from '../../../types/api';
import { OrdersV4DocumentItemPicker, filterOrdersV4DocumentItems } from './OrdersV4DocumentItemPicker';
import { addOrMergeDraftLine } from './OrdersV4DocumentsTab';

vi.mock('../../../i18n/useTranslation', async () => {
  const translations = await vi.importActual<typeof import('../../../i18n/translations')>('../../../i18n/translations');
  return {
    useTranslation: () => ({
      lang: 'ar',
      t: (key: string, ...replacements: Array<string | number>) => translations.getText(key, 'ar', ...replacements),
    }),
  };
});

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
  it('increments the existing item instead of creating a duplicate row', () => {
    const current = [{
      key: 'line-1',
      itemId: items[0].id,
      quantity: '2',
      unitId: unit.id,
      unitPrice: '10',
      priceUnitId: unit.id,
    }];

    const next = addOrMergeDraftLine(current, {
      itemId: items[0].id,
      quantity: '3',
      unitId: unit.id,
      unitPrice: '12',
      priceUnitId: unit.id,
    });

    expect(next).toHaveLength(1);
    expect(next[0].quantity).toBe('5');
    expect(next[0].unitPrice).toBe('12');
    expect(next[0].key).toBe('line-1');
  });

  it('filters by section, item text, SKU, and category', () => {
    expect(filterOrdersV4DocumentItems(items, kitchen.id, '')).toEqual([items[0]]);
    expect(filterOrdersV4DocumentItems(items, '', 'COLA')).toEqual([items[1]]);
    expect(filterOrdersV4DocumentItems(items, '', 'غازية')).toEqual([items[1]]);
  });

  it('renders products as POS buttons and selects by click', () => {
    const onSelect = vi.fn();
    const onRemove = vi.fn();
    render(
      <OrdersV4DocumentItemPicker
        items={items}
        sections={[kitchen, drinks]}
        sectionId=""
        onSectionChange={() => undefined}
        selectedQuantities={new Map([['item-1', 2]])}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    );

    const potatoes = screen.getByRole('button', { name: 'بطاطس' });
    expect(potatoes.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(potatoes);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
    fireEvent.click(screen.getByRole('button', { name: 'إزالة بطاطس' }));
    expect(onRemove).toHaveBeenCalledWith(items[0].id);
  });

  it('supports the section buttons and search field', () => {
    function ControlledPicker() {
      const [sectionId, setSectionId] = React.useState('');
      return (
        <OrdersV4DocumentItemPicker
          items={items}
          sections={[kitchen, drinks]}
          sectionId={sectionId}
          onSectionChange={setSectionId}
          selectedQuantities={new Map()}
          onSelect={() => undefined}
          onRemove={() => undefined}
        />
      );
    }
    render(
      <ControlledPicker />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'المشروبات' }));
    expect(screen.queryByRole('button', { name: /بطاطس/ })).toBeNull();
    expect(screen.getByRole('button', { name: /كولا/ })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('ابحث باسم الصنف أو الكود أو الفئة…'), { target: { value: 'غير موجود' } });
    expect(screen.getByText('لا توجد أصناف مطابقة للبحث.')).toBeTruthy();
  });
});
