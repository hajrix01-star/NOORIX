import { Prisma } from '@prisma/client';
import { resolveOrdersV4DocumentUnitPrice } from './orders-v4-registration-price.util';

describe('Orders V4 registration price', () => {
  it('uses the approved sale price and ignores a client-supplied price', () => {
    expect(resolveOrdersV4DocumentUnitPrice({
      documentType: 'registration',
      isRegistrationCancellation: false,
      itemName: 'برياني',
      requestedPrice: '1',
      salePrice: new Prisma.Decimal('35'),
    }).toString()).toBe('35');
  });
});
