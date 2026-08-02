import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OrderProduct } from '../../types/api';
import { buildProductUnitSelectionModel } from './utils/productUnitConversionModel';
import { defaultVariantModalState } from './utils/staffOrderBasketUtils';
import { VariantPickModal } from './StaffOrdersViewParts';

afterEach(cleanup);

describe('staff order variant picker', () => {
  it('renders only central priced choices and never raw product sizes', () => {
    const product: OrderProduct = {
      id: 'product-1',
      nameAr: 'Test product',
      unit: 'piece',
      sizes: 'legacy-size',
      variants: [
        { size: 'single', unit: 'piece', lastPrice: 5 },
        { packaging: 'carton', unit: 'carton', lastPrice: 80 },
        { size: 'unpriced', unit: 'piece', lastPrice: 0 },
      ],
      inventoryConversions: [
        { fromUnit: 'carton', toUnit: 'piece', multiplier: 16 },
      ],
    };
    const modal = defaultVariantModalState(product);
    const choices = buildProductUnitSelectionModel(product).pricedChoices;
    const cartonChoice = choices.find((choice) => choice.unit === 'carton');
    const onChange = vi.fn();

    expect(modal).not.toBeNull();
    expect(cartonChoice).toBeDefined();
    if (!modal || !cartonChoice) return;

    render(
      <VariantPickModal
        variantModal={modal}
        lang="en"
        t={(key) => key}
        onClose={() => {}}
        onChange={onChange}
        onConfirm={() => {}}
      />,
    );

    const select = screen.getByLabelText('ordersProductVariants');
    const optionText = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(optionText).toHaveLength(2);
    expect(optionText.join(' ')).toContain('single');
    expect(optionText.join(' ')).toContain('carton');
    expect(optionText.join(' ')).not.toContain('legacy-size');
    expect(optionText.join(' ')).not.toContain('unpriced');

    fireEvent.change(select, { target: { value: cartonChoice.key } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      variantKey: cartonChoice.key,
      packaging: 'carton',
      unit: 'carton',
      unitPrice: '80',
    }));
  });
});
