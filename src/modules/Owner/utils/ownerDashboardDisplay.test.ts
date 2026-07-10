import { describe, expect, it } from 'vitest';
import { buildOwnerCompanySeries, ownerCompanyName } from './ownerDashboardDisplay';

describe('ownerDashboardDisplay', () => {
  it('resolves bilingual company names without changing financial values', () => {
    expect(ownerCompanyName({ nameAr: 'العربية', nameEn: 'English' }, 'ar', 'id')).toBe('العربية');
    expect(ownerCompanyName({ nameAr: 'العربية', nameEn: 'English' }, 'en', 'id')).toBe('English');
    expect(ownerCompanyName({ nameAr: '', nameEn: null }, 'ar', 'fallback')).toBe('fallback');
  });

  it('builds chart series from backend companies and fixed colors', () => {
    expect(
      buildOwnerCompanySeries(
        [
          { id: 'c1', nameAr: 'الأولى', nameEn: 'First' },
          { id: 'c2', nameAr: 'الثانية', nameEn: null },
        ],
        'en',
        ['#111', '#222'],
      ),
    ).toEqual([
      { key: 'c1', label: 'First', color: '#111' },
      { key: 'c2', label: 'الثانية', color: '#222' },
    ]);
  });
});
