import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderLinePayload, OrderProduct } from '../../../types/api';
import { OrderDraftItemsTable } from './OrderFormModalPieces';

vi.mock('../../../components/common/ProductSearchInput', () => ({
  ProductSearchInput: ({
    onSelectProduct,
  }: {
    onSelectProduct?: (selection: {
      productId: string;
      variantKey: string;
      size: string;
      packaging: string;
      unit: string;
      unitPrice: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSelectProduct?.({
        productId: 'product-2',
        variantKey: 'bottle|bottle|bottle',
        size: 'bottle',
        packaging: 'bottle',
        unit: 'bottle',
        unitPrice: '15',
      })}
    >
      select-priced-product
    </button>
  ),
}));

const product: OrderProduct = {
  id: 'product-1',
  nameAr: 'Test product',
  unit: 'piece',
  inventoryConversions: [
    { fromUnit: 'carton', toUnit: 'piece', multiplier: 10 },
  ],
  variants: [
    { size: 'single', unit: 'piece', lastPrice: 25 },
    { size: 'bulk', packaging: 'carton', unit: 'carton', lastPrice: 220 },
  ],
};

const pricedProduct: OrderProduct = {
  id: 'product-2',
  nameAr: 'Priced product',
  unit: 'piece',
  inventoryConversions: [
    { fromUnit: 'bottle', toUnit: 'piece', multiplier: 6 },
  ],
  variants: [{ size: 'bottle', packaging: 'bottle', unit: 'bottle', lastPrice: 15 }],
};

function Harness() {
  const [items, setItems] = useState<CreateOrderLinePayload[]>([{
    productId: product.id,
    size: 'single',
    packaging: '',
    unit: 'piece',
    quantity: '1',
    unitPrice: '25',
  }]);
  const productsById = new Map([
    [product.id, product],
    [pricedProduct.id, pricedProduct],
  ]);

  return (
    <OrderDraftItemsTable
      items={items}
      enrichedItems={items.map((item) => ({
        ...item,
        amount: new Decimal(item.quantity || 0).times(item.unitPrice || 0),
        product: productsById.get(item.productId),
      }))}
      productsById={productsById}
      searchProducts={[]}
      searchProductsById={new Map()}
      t={(key) => key}
      updateItem={(idx, field, value) => {
        setItems((current) => current.map((item, itemIdx) => (
          itemIdx === idx ? { ...item, [field]: value } : item
        )));
      }}
      updateItems={setItems}
      removeItem={() => {}}
    />
  );
}

afterEach(cleanup);

describe('OrderDraftItemsTable variant pricing', () => {
  it('applies a priced unit connected to the central conversion chain', () => {
    render(<Harness />);

    const variantSelect = screen.getByRole('combobox');
    const unitPrice = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;

    expect(unitPrice.value).toBe('25');

    fireEvent.change(variantSelect, { target: { value: 'bulk|carton|carton' } });
    expect(unitPrice.value).toBe('220');
  });

  it('replaces the complete row selection supplied by the central product picker', () => {
    render(<Harness />);

    const unitPrice = screen.getAllByRole('spinbutton')[1] as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'select-priced-product' }));

    expect(unitPrice.value).toBe('15');
  });
});
