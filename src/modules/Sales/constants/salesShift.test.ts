import { describe, it, expect } from 'vitest';
import {
  getSalesShiftLabel,
  isSalesShiftValue,
  listShiftFilterToApiParam,
  parseSalesShiftValue,
} from './salesShift';

describe('salesShift', () => {
  const t = (k: string) => k;

  it('isSalesShiftValue', () => {
    expect(isSalesShiftValue('morning')).toBe(true);
    expect(isSalesShiftValue('')).toBe(false);
  });

  it('listShiftFilterToApiParam', () => {
    expect(listShiftFilterToApiParam('any')).toBeUndefined();
    expect(listShiftFilterToApiParam('morning')).toBe('morning');
    expect(listShiftFilterToApiParam('all')).toBe('all');
  });

  it('parseSalesShiftValue', () => {
    expect(parseSalesShiftValue('evening')).toBe('evening');
    expect(parseSalesShiftValue(null, 'all')).toBe('all');
  });

  it('getSalesShiftLabel', () => {
    expect(getSalesShiftLabel('morning', t)).toBe('salesShiftMorning');
    expect(getSalesShiftLabel('all', t)).toBe('salesShiftFullDay');
  });
});
