import {
  MASTER_SUBCATEGORIES,
  MASTER_SUPPLIERS,
} from './accounting-init-master-seeds.util';
import {
  DEFAULT_COMPANY_SUPPLIER_DIRECTORY_CODES,
  SUPPLIER_DIRECTORY_SEEDS,
} from '../supplier-directory/supplier-directory.seed';

describe('accounting initialization master seeds', () => {
  it('seeds the approved government categories without taking over E2-9', () => {
    const byCode = new Map(MASTER_SUBCATEGORIES.map((entry) => [entry.code, entry]));
    expect(byCode.get('E2-8')?.nameAr).toBe('GOSI');
    expect(byCode.get('E2-10')?.nameAr).toBe('رسوم منصات حكومية');
    expect(byCode.get('E2-11')?.nameAr).toBe('شهادات صحية وتصاريح موظفين');
    expect(byCode.get('E4-1')?.nameAr).toBe('تذاكر سفر الموظفين');
    expect(byCode.get('E4-1')?.parentAccountCode).toBe('EXP-004');
    expect(byCode.get('E4-2')?.nameAr).toBe('التأمين الطبي للموظفين');
    expect(byCode.get('E4-2')?.parentAccountCode).toBe('EXP-004');
    expect(byCode.has('E2-9')).toBe(false);
  });

  it('seeds the approved general service, residency, municipal, and commerce suppliers', () => {
    expect(MASTER_SUPPLIERS.map((entry) => entry.directoryCode)).toEqual(
      DEFAULT_COMPANY_SUPPLIER_DIRECTORY_CODES,
    );
    expect(MASTER_SUPPLIERS).toHaveLength(16);
    expect(MASTER_SUPPLIERS.map((entry) => entry.directoryCode)).toEqual(
      expect.arrayContaining([
        'UTL-SA-ENERGY',
        'TEL-STC',
        'GOV-GOSI',
        'GOV-ZATCA',
        'GOV-MOC',
        'GOV-SBC',
        'GOV-MOMAH',
        'GOV-HRSD',
        'GOV-PASSPORTS',
        'GOV-CIVIL-DEFENSE',
        'GOV-FSC',
        'PLT-QIWA',
        'PLT-ABSHER-BUSINESS',
        'PLT-MUDAD',
        'PLT-MUQEEM',
        'PLT-BALADY',
      ]),
    );
  });

  it('derives every default supplier and category from the central directory', () => {
    const directoryByCode = new Map(
      SUPPLIER_DIRECTORY_SEEDS.map((entry) => [entry.code, entry]),
    );
    const categoryByCode = new Map(
      MASTER_SUBCATEGORIES.map((entry) => [entry.code, entry]),
    );
    expect(new Set(MASTER_SUPPLIERS.map((entry) => entry.directoryCode)).size)
      .toBe(MASTER_SUPPLIERS.length);

    for (const supplier of MASTER_SUPPLIERS) {
      const directoryEntry = directoryByCode.get(supplier.directoryCode);
      expect(directoryEntry).toBeDefined();
      expect(supplier.nameAr).toBe(directoryEntry?.nameAr);
      expect(supplier.isTaxRegistered).toBe(directoryEntry?.isTaxRegistered);
      expect(categoryByCode.get(directoryEntry?.defaultCategoryCode ?? '')?.nameAr)
        .toBe(supplier.subCategoryNameAr);
    }
  });

  it('keeps activity-specific entities optional', () => {
    const defaults = new Set(MASTER_SUPPLIERS.map((entry) => entry.directoryCode));
    expect(defaults.has('GOV-MISA')).toBe(false);
    expect(defaults.has('GOV-SFDA')).toBe(false);
    expect(defaults.has('GOV-SASO')).toBe(false);
    expect(defaults.has('GOV-SAIP')).toBe(false);
  });
});
