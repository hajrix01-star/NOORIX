import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrderProduct } from '../../../types/api';
import type { ProductPricedUnitChoice } from '../utils/productUnitConversionModel';
import { OrderProductAddModal } from './OrderProductAddModal';

const product: OrderProduct = {
  id: 'product-1',
  nameAr: 'Test product',
};

const choices: ProductPricedUnitChoice[] = [
  {
    key: 'piece',
    size: 'single',
    packaging: '',
    unit: 'piece',
    unitPrice: '25',
    inventoryMultiplier: 1,
  },
  {
    key: 'carton',
    size: 'bulk',
    packaging: 'carton',
    unit: 'carton',
    unitPrice: '220',
    inventoryMultiplier: 10,
  },
];

function Harness() {
  const [addModal, setAddModal] = useState({
    product,
    variantKey: 'piece',
    size: 'single',
    packaging: '',
    unit: 'piece',
    quantity: '1',
    unitPrice: '25',
  });

  return (
    <OrderProductAddModal
      addModal={addModal}
      productName={product.nameAr}
      choices={choices}
      t={(key) => key}
      setAddModal={(next) => {
        setAddModal((current) => {
          const resolved = typeof next === 'function' ? next(current) : next;
          return resolved ?? current;
        });
      }}
      onConfirm={() => {}}
    />
  );
}

afterEach(cleanup);

describe('OrderProductAddModal variant pricing', () => {
  it('applies the complete central unit choice when the user changes the purchase unit', () => {
    render(<Harness />);

    const variantSelect = screen.getByLabelText('ordersProductVariants');
    const unitPrice = screen.getByLabelText('unitPrice SR') as HTMLInputElement;

    expect(unitPrice.value).toBe('25');

    fireEvent.change(variantSelect, { target: { value: 'carton' } });
    expect(unitPrice.value).toBe('220');
    expect((variantSelect as HTMLSelectElement).value).toBe('carton');
  });
});
