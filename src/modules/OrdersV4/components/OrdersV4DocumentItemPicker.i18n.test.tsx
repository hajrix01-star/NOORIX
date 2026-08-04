import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { OrdersV4Item, OrdersV4Section } from '../../../types/api';
import { OrdersV4DocumentItemPicker } from './OrdersV4DocumentItemPicker';

vi.mock('../../../i18n/useTranslation', async () => {
  const translations = await vi.importActual<typeof import('../../../i18n/translations')>('../../../i18n/translations');
  return {
    useTranslation: () => ({
      lang: 'en',
      t: (key: string, ...replacements: Array<string | number>) => translations.getText(key, 'en', ...replacements),
    }),
  };
});

const piece = {
  id: 'piece', code: 'piece', nameAr: 'حبة', nameEn: 'Piece', dimension: 'count',
  decimalScale: 0, isActive: true,
};
const section = {
  id: 'bar', code: 'bar', nameAr: 'بار', nameEn: 'Bar', isActive: true,
} satisfies OrdersV4Section;
const item = {
  id: 'pepsi', sku: 'P-1', nameAr: 'بيبسي', nameEn: 'Pepsi', itemType: 'sale',
  categoryId: 'drinks', inventoryUnitId: piece.id, trackInventory: true, isActive: true,
  inventoryUnit: piece,
  units: [{ id: 'item-piece', unitId: piece.id, isOrderEnabled: true, isActive: true, sortOrder: 1, unit: piece }],
  category: { id: 'drinks', nameAr: 'مشروبات', nameEn: 'Drinks', isActive: true },
  sections: [{ section }],
} satisfies OrdersV4Item;

describe('OrdersV4DocumentItemPicker localization', () => {
  it('renders item, unit, category, section, and controls in English', () => {
    render(<OrdersV4DocumentItemPicker
      items={[item]}
      sections={[section]}
      sectionId=""
      onSectionChange={vi.fn()}
      selectedQuantities={new Map()}
      onSelect={vi.fn()}
      onRemove={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Pepsi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bar' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search by item, code, or category…')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Drinks' })).toBeTruthy();
    expect(screen.getByText('Drinks · Piece')).toBeTruthy();
    expect(screen.queryByText('بيبسي')).toBeNull();
    expect(screen.queryByText('حبة')).toBeNull();
  });
});
