import { describe, it, expect } from 'vitest';
import { buildCompanyUpdateBody, mergeCompanySavePatch } from './companyUpdateBody';

describe('buildCompanyUpdateBody', () => {
  it('always includes salesShiftsEnabled even when unchanged from baseline', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      salesShiftsEnabled: true,
      _initial: { salesShiftsEnabled: true },
    });
    expect(body.salesShiftsEnabled).toBe(true);
    expect(body.nameAr).toBe('شركة');
  });

  it('sends salesShiftsEnabled true when toggled on from false baseline', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      salesShiftsEnabled: true,
      _initial: { salesShiftsEnabled: false },
    });
    expect(body.salesShiftsEnabled).toBe(true);
  });

  it('sends salesShiftsEnabled false when toggled off', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      salesShiftsEnabled: false,
      _initial: { salesShiftsEnabled: true },
    });
    expect(body.salesShiftsEnabled).toBe(false);
  });

  it('omits unchanged text fields but keeps nameAr and salesShiftsEnabled', () => {
    const body = buildCompanyUpdateBody({
      nameAr: 'شركة',
      nameEn: 'Co',
      salesShiftsEnabled: false,
      _initial: { nameEn: 'Co', salesShiftsEnabled: false },
    });
    expect(body).toEqual({ nameAr: 'شركة', salesShiftsEnabled: false });
  });
});

describe('mergeCompanySavePatch', () => {
  it('prefers server salesShiftsEnabled in cache patch', () => {
    const merged = mergeCompanySavePatch(
      { data: { id: 'c1', salesShiftsEnabled: true, nameAr: 'شركة' } },
      { id: 'c1', body: { nameAr: 'شركة', salesShiftsEnabled: true } },
    );
    expect(merged?.patch.salesShiftsEnabled).toBe(true);
  });

  it('coerces string false from server', () => {
    const merged = mergeCompanySavePatch(
      { data: { id: 'c1', salesShiftsEnabled: 'false' } },
      { id: 'c1', body: {} },
    );
    expect(merged?.patch.salesShiftsEnabled).toBe(false);
  });
});
