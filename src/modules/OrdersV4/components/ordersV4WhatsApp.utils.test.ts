import { describe, expect, it } from 'vitest';
import type { OrdersV4Document } from '../../../types/api';
import { buildOrdersV4WhatsAppText } from './ordersV4WhatsApp.utils';

const unit = {
  id: 'piece', code: 'piece', nameAr: 'حبة', dimension: 'count', decimalScale: 3, isActive: true,
};

function document(overrides: Partial<OrdersV4Document> = {}): OrdersV4Document {
  return {
    id: 'document-1',
    documentNumber: 'REG4-20260802-ABC123',
    documentType: 'registration',
    documentDate: '2026-08-02T00:00:00.000Z',
    status: 'received',
    revision: 1,
    createdAt: '2026-08-02T10:00:00.000Z',
    locationId: 'location-1',
    subtotal: '0',
    totalAmount: '0',
    operationalCost: '0',
    notes: 'للفترة المسائية',
    section: { id: 'section-1', code: 'BAR', nameAr: 'بار', isActive: true },
    location: { id: 'location-1', code: 'MAIN', nameAr: 'الرئيسي', kind: 'main', isActive: true },
    lines: [{
      id: 'line-1', lineNumber: 1, itemId: 'item-1', itemNameSnapshot: 'شاي',
      inputQuantity: '2', inputUnitId: unit.id, baseQuantity: '2', baseUnitId: unit.id,
      unitPrice: '0', priceUnitId: unit.id, priceQuantity: '2', lineTotal: '0', operationalCost: '0',
      item: {} as OrdersV4Document['lines'][number]['item'], inputUnit: unit, baseUnit: unit, priceUnit: unit,
    }],
    ...overrides,
  };
}

describe('buildOrdersV4WhatsAppText', () => {
  it('matches the old internal-registration message flow using saved V4 data', () => {
    const text = buildOrdersV4WhatsAppText(document());

    expect(text).toContain('تسجيل داخلي — بار');
    expect(text).toContain('يوم التسجيل: 2026/08/02');
    expect(text).toContain('رقم العملية: REG4-20260802-ABC123');
    expect(text).toContain('• شاي (حبة): 2');
    expect(text).toContain('إجمالي الكمية: 2');
    expect(text).toContain('ملاحظات: للفترة المسائية');
    expect(text).not.toContain('SR');
  });

  it('builds the old purchase-style message with payment and totals', () => {
    const text = buildOrdersV4WhatsAppText(document({
      documentNumber: 'REQ4-20260802-ABC123',
      documentType: 'purchase',
      paymentMethod: 'custody',
      totalAmount: '30',
      lines: [{ ...document().lines[0], inputQuantity: '3', unitPrice: '10', lineTotal: '30' }],
    }));

    expect(text).toContain('طلب REQ4-20260802-ABC123');
    expect(text).toContain('طريقة الدفع: عهدة');
    expect(text).toContain('شاي (حبة): 3 × 10 = 30 SR');
    expect(text).toContain('الإجمالي: 30 SR');
  });

  it('shows each cancelled item reasons in the independent cancellation message', () => {
    const text = buildOrdersV4WhatsAppText(document({
      documentNumber: 'CAN4-20260803-ABC123',
      registrationEntryType: 'cancellation',
      lines: [{
        ...document().lines[0],
        inputQuantity: '-2',
        cancellationReasons: ['order_error', 'duplicate_order'],
        cancellationNote: 'اختبار رقابي',
      }],
    }));

    expect(text).toContain('سجل إلغاء');
    expect(text).toContain('خطأ في الطلب، طلب مكرر');
    expect(text).toContain('اختبار رقابي');
  });
});
