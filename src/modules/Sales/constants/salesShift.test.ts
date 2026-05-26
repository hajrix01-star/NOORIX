import { describe, it, expect } from 'vitest';
import { parseShiftFromNotes, resolveSalesSummaryShift } from './salesShift';

describe('parseShiftFromNotes', () => {
  it('parses morning tag', () => {
    expect(parseShiftFromNotes('x\n[شفت: شفت صباحي]')).toBe('morning');
  });
});

describe('resolveSalesSummaryShift', () => {
  it('prefers notes over all in DB', () => {
    expect(
      resolveSalesSummaryShift({
        shift: 'all',
        notes: '[شفت: شفت مسائي]',
      }),
    ).toBe('evening');
  });

  it('keeps morning from DB', () => {
    expect(resolveSalesSummaryShift({ shift: 'morning' })).toBe('morning');
  });
});
