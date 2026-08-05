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

  it('includes a changed display order as a positive integer', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      sortOrder: 2.9,
      _initial: { sortOrder: 5 },
    });
    expect(body.sortOrder).toBe(2);
  });

  it('omits an unchanged display order', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      sortOrder: 3,
      _initial: { sortOrder: 3 },
    });
    expect(body).not.toHaveProperty('sortOrder');
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
