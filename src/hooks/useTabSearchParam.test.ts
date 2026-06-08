import { describe, it, expect } from 'vitest';
import { pickTabFromSearchParams } from './useTabSearchParam';

const OCR = ['upload', 'review', 'invoices', 'suppliers', 'items', 'alerts', 'purchases'];

describe('pickTabFromSearchParams (OCR + legacy tab)', () => {
  it('prefers ocrTab when set', () => {
    const sp = new URLSearchParams('ocrTab=review&tab=history');
    expect(pickTabFromSearchParams(sp, OCR, 'upload', 'ocrTab', 'tab')).toBe('review');
  });

  it('ignores stale tab=history from other screens', () => {
    const sp = new URLSearchParams('tab=history');
    expect(pickTabFromSearchParams(sp, OCR, 'upload', 'ocrTab', 'tab')).toBe('upload');
  });

  it('accepts legacy tab=review when ocrTab absent', () => {
    const sp = new URLSearchParams('tab=review');
    expect(pickTabFromSearchParams(sp, OCR, 'upload', 'ocrTab', 'tab')).toBe('review');
  });

  it('falls back to default when empty', () => {
    const sp = new URLSearchParams('');
    expect(pickTabFromSearchParams(sp, OCR, 'upload', 'ocrTab', 'tab')).toBe('upload');
  });

  it('resolves tab aliases to allowed ids', () => {
    const sp = new URLSearchParams('tab=sales');
    const ids = ['orders', 'sales-report'];
    expect(pickTabFromSearchParams(sp, ids, 'orders', 'tab', null, { sales: 'sales-report' })).toBe('sales-report');
  });
});

describe('pickTabFromSearchParams (Orders screen-specific key)', () => {
  const ORDER_TABS = ['staff-sales', 'orders', 'sales-report'] as const;

  it('prefers ordersTab over stale tab from other screens', () => {
    const sp = new URLSearchParams('ordersTab=sales-report&tab=overview');
    expect(pickTabFromSearchParams(sp, ORDER_TABS, 'staff-sales', 'ordersTab', 'tab')).toBe('sales-report');
  });

  it('falls back to legacy tab when ordersTab absent', () => {
    const sp = new URLSearchParams('tab=sales-report');
    expect(pickTabFromSearchParams(sp, ORDER_TABS, 'staff-sales', 'ordersTab', 'tab')).toBe('sales-report');
  });
});
