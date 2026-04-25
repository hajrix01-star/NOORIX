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
});
