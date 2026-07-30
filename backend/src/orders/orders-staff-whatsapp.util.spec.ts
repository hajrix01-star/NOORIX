import { buildSalesWhatsAppTextCombined } from './orders-staff-whatsapp.util';

describe('orders-staff-whatsapp.util', () => {
  it('keeps internal sales WhatsApp text quantity-only without money totals', () => {
    const text = buildSalesWhatsAppTextCombined(
      [
        {
          sectionName: 'Front',
          items: [
            { quantity: 2, unitPrice: 10, product: { nameEn: 'Coal' } },
            { quantity: 1, unitPrice: 5, product: { nameEn: 'Tea' } },
          ],
        },
      ],
      new Date('2026-07-28T00:00:00.000Z'),
      'en',
      'DS-20260728-001',
    );

    expect(text).toContain('Coal: 2');
    expect(text).toContain('Tea: 1');
    expect(text).toContain('Total qty: 3');
    expect(text).not.toContain('SR');
    expect(text).not.toContain('Grand total');
    expect(text).not.toContain('Avg per order');
    expect(text).not.toContain('=');
  });
});
