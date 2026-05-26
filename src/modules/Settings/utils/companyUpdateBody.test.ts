import { describe, it, expect } from 'vitest';
import { buildCompanyUpdateBody, mergeCompanySavePatch } from './companyUpdateBody';

describe('buildCompanyUpdateBody', () => {
  it('always includes nameAr', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      nameEn: 'Co',
      _initial: { nameEn: 'Co' },
    });
    expect(body).toEqual({ nameAr: 'شركة' });
  });

  it('includes changed text fields only', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      phone: '05',
      _initial: { phone: '' },
    });
    expect(body).toEqual({ nameAr: 'شركة', phone: '05' });
  });

  it('does not include salesShiftsEnabled', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      salesShiftsEnabled: true,
    });
    expect(body).not.toHaveProperty('salesShiftsEnabled');
  });
});

describe('mergeCompanySavePatch', () => {
  it('merges server company into patch', () => {
    const merged = mergeCompanySavePatch(
      { data: { id: 'c1', nameAr: 'شركة', phone: '05' } },
      { id: 'c1', body: { nameAr: 'شركة', phone: '05' } },
    );
    expect(merged?.patch.nameAr).toBe('شركة');
    expect(merged?.patch.phone).toBe('05');
  });
});
