import { describe, expect, it } from 'vitest';
import {
  toDashboardNonNegativeNumber,
  toDashboardNumber,
  toDashboardOptionalNumber,
} from './dashboardNumberModel';

describe('dashboardNumberModel', () => {
  it('normalizes formatted numeric input', () => {
    expect(toDashboardNumber('1,250.50')).toBe(1250.5);
    expect(toDashboardOptionalNumber(' 42 ')).toBe(42);
  });

  it('rejects invalid optional values without falling back to zero', () => {
    expect(toDashboardOptionalNumber('')).toBeNull();
    expect(toDashboardOptionalNumber('nope')).toBeNull();
    expect(toDashboardNonNegativeNumber('-1')).toBeNull();
  });
});
