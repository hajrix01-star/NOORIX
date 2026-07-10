import { describe, it, expect } from 'vitest';
import {
  exportToExcel,
  importFromExcel,
  flattenOrderProductsToAoA,
  ORDER_PRODUCTS_EXCEL_HEADERS,
  normalizeColumnDefs,
} from './exportUtils';

describe('exportUtils barrel', () => {
  it('re-exports excel helpers', () => {
    expect(typeof exportToExcel).toBe('function');
    expect(typeof importFromExcel).toBe('function');
  });

  it('re-exports orders helpers', () => {
    expect(Array.isArray(ORDER_PRODUCTS_EXCEL_HEADERS)).toBe(true);
    const aoa = flattenOrderProductsToAoA([]);
    expect(aoa[0]).toEqual(ORDER_PRODUCTS_EXCEL_HEADERS);
  });

  it('re-exports normalizeColumnDefs', () => {
    expect(normalizeColumnDefs(['x']).keys).toEqual(['x']);
  });
});
