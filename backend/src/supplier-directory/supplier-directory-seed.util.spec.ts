import { SUPPLIER_DIRECTORY_SEEDS } from './supplier-directory.seed';
import { directoryIdentitySimilarity } from './supplier-directory-search.util';

describe('supplier directory seed governance', () => {
  it('uses stable unique codes and deterministic sort orders', () => {
    const codes = SUPPLIER_DIRECTORY_SEEDS.map((entry) => entry.code);
    const sortOrders = SUPPLIER_DIRECTORY_SEEDS.map((entry) => entry.sortOrder);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(sortOrders).size).toBe(sortOrders.length);
    expect(SUPPLIER_DIRECTORY_SEEDS).toHaveLength(24);
  });

  it('keeps the approved accounting mappings', () => {
    const categoryByCode = new Map(
      SUPPLIER_DIRECTORY_SEEDS.map((entry) => [entry.code, entry.defaultCategoryCode]),
    );
    expect(categoryByCode.get('GOV-GOSI')).toBe('E2-8');
    expect(categoryByCode.get('GOV-MOMAH')).toBe('E2-2');
    expect(categoryByCode.get('PLT-QIWA')).toBe('E2-10');
    expect(categoryByCode.get('UTL-NWC')).toBe('E3-4');
    expect(categoryByCode.get('TEL-STC')).toBe('E3-3');
  });

  it('marks government entities as non-tax and utilities as invoice-bearing', () => {
    for (const entry of SUPPLIER_DIRECTORY_SEEDS) {
      if (entry.entityType === 'government' || entry.entityType === 'government_platform') {
        expect(entry.isTaxRegistered).toBe(false);
        expect(entry.supplierInvoiceNumberRequired).toBe(false);
      } else {
        expect(entry.isTaxRegistered).toBe(true);
        expect(entry.supplierInvoiceNumberRequired).toBe(true);
      }
    }
  });

  it('does not include excluded hospital, shipping, or insurance catalogs', () => {
    const catalog = SUPPLIER_DIRECTORY_SEEDS
      .flatMap((entry) => [entry.nameAr, entry.nameEn, ...entry.aliases])
      .join(' ')
      .toLocaleLowerCase();
    expect(catalog).not.toContain('مستشفى');
    expect(catalog).not.toContain('شحن');
    expect(SUPPLIER_DIRECTORY_SEEDS.map((entry) => entry.entityType)).not.toContain('insurance');
  });

  it('does not auto-match aliases belonging to different directory entities', () => {
    const unsafePairs: string[] = [];
    for (const left of SUPPLIER_DIRECTORY_SEEDS) {
      const leftValues = [left.nameAr, left.nameEn, ...left.aliases];
      for (const right of SUPPLIER_DIRECTORY_SEEDS) {
        if (left.code >= right.code) continue;
        const rightValues = [right.nameAr, right.nameEn, ...right.aliases];
        for (const leftValue of leftValues) {
          for (const rightValue of rightValues) {
            if (directoryIdentitySimilarity(leftValue, rightValue) >= 0.68) {
              unsafePairs.push(`${left.code}:${leftValue} -> ${right.code}:${rightValue}`);
            }
          }
        }
      }
    }
    expect(unsafePairs).toEqual([]);
  });
});
