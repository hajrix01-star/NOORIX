import { describe, expect, it } from 'vitest';
import {
  buildSupplierCategoryOptions,
  buildSupplierCreatePayload,
  buildSupplierUpdatePayload,
  supplierFormFromRecord,
} from './supplierFormModel';

describe('supplier form model', () => {
  it('builds create and update payloads from the same normalized state', () => {
    const form = supplierFormFromRecord({
      id: 's1',
      nameAr: '  مورد  ',
      nameEn: '',
      taxNumber: ' 300000000000003 ',
      phone: '',
      supplierType: 'expense',
      isTaxRegistered: null,
    });

    expect(buildSupplierCreatePayload('c1', form)).toEqual({
      companyId: 'c1',
      nameAr: 'مورد',
      nameEn: undefined,
      taxNumber: '300000000000003',
      phone: undefined,
      supplierType: 'expenses',
      supplierCategoryId: undefined,
      isTaxRegistered: true,
    });
    expect(buildSupplierUpdatePayload(form)).not.toHaveProperty('companyId');
  });

  it('filters category picker options by supplier type', () => {
    expect(buildSupplierCategoryOptions([
      { id: 'p1', nameAr: 'مشتريات', type: 'purchase' },
      { id: 'e1', nameAr: 'مصروفات', type: 'expense' },
    ], 'expenses', 'ar')).toEqual([
      { value: 'e1', label: 'مصروفات' },
    ]);
  });
});
