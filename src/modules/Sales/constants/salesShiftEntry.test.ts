import { describe, it, expect } from 'vitest';
import {
  EMPTY_SALES_ENTRY_SELECTION,
  getActiveEntryShifts,
  hasEntrySelection,
  toggleEntryShift,
} from './salesShiftEntry';

describe('salesShiftEntry', () => {
  it('full day is exclusive', () => {
    const sel = toggleEntryShift(
      { fullDay: false, morning: true, evening: true },
      'fullDay',
    );
    expect(sel).toEqual({ fullDay: true, morning: false, evening: false });
    expect(getActiveEntryShifts(sel)).toEqual(['all']);
  });

  it('morning and evening together', () => {
    const sel = { fullDay: false, morning: true, evening: true };
    expect(getActiveEntryShifts(sel)).toEqual(['morning', 'evening']);
    expect(hasEntrySelection(sel)).toBe(true);
  });

  it('turning on shift clears full day', () => {
    const sel = toggleEntryShift(EMPTY_SALES_ENTRY_SELECTION, 'morning');
    expect(sel.fullDay).toBe(false);
    expect(sel.morning).toBe(true);
  });
});
