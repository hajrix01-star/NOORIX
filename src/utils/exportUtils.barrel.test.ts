import { describe, it, expect } from 'vitest';
import {
  exportToExcel,
  importFromExcel,
  normalizeColumnDefs,
} from './exportUtils';

describe('exportUtils barrel', () => {
  it('re-exports excel helpers', () => {
    expect(typeof exportToExcel).toBe('function');
    expect(typeof importFromExcel).toBe('function');
  });

  it('re-exports normalizeColumnDefs', () => {
    expect(normalizeColumnDefs(['x']).keys).toEqual(['x']);
  });
});
