import { BadRequestException } from '@nestjs/common';
import {
  normalizeCancellationReasons,
  staffCancellationVariantKey,
} from './orders-staff-cancellation.util';

describe('staff internal cancellation rules', () => {
  it('keeps unique supported reasons', () => {
    expect(normalizeCancellationReasons({
      productId: 'p1',
      quantity: '1',
      cancellationReasons: ['customer_disliked', 'replaced_item', 'customer_disliked'],
    }, true)).toEqual(['customer_disliked', 'replaced_item']);
  });

  it('requires at least one reason for a cancellation', () => {
    expect(() => normalizeCancellationReasons({
      productId: 'p1',
      quantity: '1',
      cancellationReasons: [],
    }, true)).toThrow(BadRequestException);
  });

  it('requires a note only when other is selected', () => {
    expect(() => normalizeCancellationReasons({
      productId: 'p1',
      quantity: '1',
      cancellationReasons: ['other'],
    }, true)).toThrow(BadRequestException);
    expect(normalizeCancellationReasons({
      productId: 'p1',
      quantity: '1',
      cancellationReasons: ['other'],
      notes: 'سبب مختصر',
    }, true)).toEqual(['other']);
  });

  it('builds an exact product variant key', () => {
    expect(staffCancellationVariantKey({
      productId: 'p1',
      size: 'وسط',
      packaging: 'علبة',
      unit: 'pack',
    })).toBe('p1|وسط|علبة|pack');
  });
});
