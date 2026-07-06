import { describe, expect, it } from 'vitest';
import { getSupplierSelectLabel } from './SupplierSelect';

describe('SupplierSelect helpers', () => {
  it('uses the shared localized display fallback for supplier labels', () => {
    expect(getSupplierSelectLabel({ id: 's1', name: 'Generic', nameAr: '', nameEn: '' }, 'ar')).toBe('Generic');
    expect(getSupplierSelectLabel({ id: 's1', name: 'Generic', nameAr: 'عربي', nameEn: 'English' }, 'en')).toBe(
      'English',
    );
    expect(getSupplierSelectLabel({ id: 's1', nameAr: 'عربي' }, 'en')).toBe('عربي');
  });
});
