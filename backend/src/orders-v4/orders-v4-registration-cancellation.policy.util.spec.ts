import { resolveOrdersV4RegistrationEntry } from './orders-v4-registration-cancellation.policy';
import type { OrdersV4DocumentInput } from './orders-v4.contracts';

function input(overrides: Partial<OrdersV4DocumentInput> = {}): OrdersV4DocumentInput {
  return {
    documentType: 'registration',
    documentDate: '2026-08-03',
    locationId: 'location-1',
    idempotencyKey: 'key-1',
    lines: [{ itemId: 'item-1', quantity: '1', unitId: 'unit-1' }],
    ...overrides,
  };
}

describe('Orders V4 registration cancellation policy', () => {
  it('defaults a normal registration to issue', () => {
    expect(resolveOrdersV4RegistrationEntry(input())).toEqual({ entryType: 'issue' });
  });

  it('accepts an independent cancellation with a controlled reason', () => {
    expect(resolveOrdersV4RegistrationEntry(input({
      registrationEntryType: 'cancellation',
      lines: [{ itemId: 'item-1', quantity: '1', unitId: 'unit-1', cancellationReasons: ['order_error', 'delayed_order'] }],
    }))).toEqual({ entryType: 'cancellation' });
  });

  it('accepts employee meals and hospitality as controlled reasons', () => {
    expect(resolveOrdersV4RegistrationEntry(input({
      registrationEntryType: 'cancellation',
      lines: [{
        itemId: 'item-1',
        quantity: '1',
        unitId: 'unit-1',
        cancellationReasons: ['employee_meal', 'hospitality'],
      }],
    }))).toEqual({ entryType: 'cancellation' });
  });

  it('requires an explanation for other', () => {
    expect(() => resolveOrdersV4RegistrationEntry(input({
      registrationEntryType: 'cancellation',
      lines: [{ itemId: 'item-1', quantity: '1', unitId: 'unit-1', cancellationReasons: ['other'] }],
    }))).toThrow('اكتب توضيح سبب الإلغاء');
  });

  it('does not allow cancellation metadata on purchases', () => {
    expect(() => resolveOrdersV4RegistrationEntry(input({
      documentType: 'purchase',
      registrationEntryType: 'cancellation',
      lines: [{ itemId: 'item-1', quantity: '1', unitId: 'unit-1', cancellationReasons: ['order_error'] }],
    }))).toThrow('بيانات الإلغاء متاحة للتسجيل الداخلي فقط');
  });
});
