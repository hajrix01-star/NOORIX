import { describe, it, expect } from 'vitest';
import { WA, waRow, waChannel } from './whatsappTextFormat';

describe('whatsappTextFormat', () => {
  it('formats parallel rows with icon and middle dot', () => {
    expect(waRow(WA.icon.cashNet, 'الكاش المتوفر:', '400 SR')).toBe('  ⊙  الكاش المتوفر ·  400 SR');
  });

  it('formats channel rows', () => {
    expect(waChannel('بنك', '996')).toBe('  │  بنك ·  996 SR');
  });
});
