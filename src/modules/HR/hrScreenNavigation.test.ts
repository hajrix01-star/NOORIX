import { describe, it, expect } from 'vitest';
import {
  defaultTabForHrSection,
  hrScreenUrlNeedsNormalization,
  LEGACY_HR_FLAT_TAB_MAP,
  resolveHrScreenFromSearchParams,
  writeHrScreenToSearchParams,
} from './hrScreenNavigation';

describe('hrScreenNavigation', () => {
  it('maps legacy flat tabs', () => {
    expect(resolveHrScreenFromSearchParams(new URLSearchParams('tab=payroll'))).toEqual({
      section: 'payroll',
      tab: 'runs',
    });
    expect(resolveHrScreenFromSearchParams(new URLSearchParams('tab=salaryCalc'))).toEqual({
      section: 'tools',
      tab: 'salary-calc',
    });
    expect(resolveHrScreenFromSearchParams(new URLSearchParams('tab=advances'))).toEqual({
      section: 'payroll',
      tab: 'advances',
    });
  });

  it('reads section + sub tab', () => {
    expect(
      resolveHrScreenFromSearchParams(new URLSearchParams('section=people&tab=leave')),
    ).toEqual({ section: 'people', tab: 'leave' });
  });

  it('falls back to default sub tab when invalid for section', () => {
    expect(
      resolveHrScreenFromSearchParams(new URLSearchParams('section=payroll&tab=leave')),
    ).toEqual({ section: 'payroll', tab: 'runs' });
  });

  it('detects legacy URLs needing normalization', () => {
    expect(hrScreenUrlNeedsNormalization(new URLSearchParams('tab=residency'))).toBe(true);
    expect(hrScreenUrlNeedsNormalization(new URLSearchParams('section=people&tab=leave'))).toBe(
      false,
    );
  });

  it('writes clean default URL', () => {
    const next = writeHrScreenToSearchParams(
      new URLSearchParams('tab=employees'),
      { section: 'people', tab: 'list' },
    );
    expect(next.get('section')).toBeNull();
    expect(next.get('tab')).toBeNull();
  });

  it('covers all legacy keys', () => {
    for (const key of Object.keys(LEGACY_HR_FLAT_TAB_MAP)) {
      expect(resolveHrScreenFromSearchParams(new URLSearchParams(`tab=${key}`)).section).toBeTruthy();
    }
  });

  it('defaultTabForHrSection', () => {
    expect(defaultTabForHrSection('tools')).toBe('salary-calc');
  });
});
