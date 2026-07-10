import { describe, expect, it } from 'vitest';
import { localizedDisplayName, localizedSecondaryDisplayName } from './displayName';

describe('displayName', () => {
  it('prefers Arabic order as nameAr, name, nameEn', () => {
    expect(localizedDisplayName({ nameAr: 'عربي', name: 'عام', nameEn: 'English' }, 'ar')).toBe('عربي');
    expect(localizedDisplayName({ name: 'عام', nameEn: 'English' }, 'ar')).toBe('عام');
    expect(localizedDisplayName({ nameEn: 'English' }, 'ar')).toBe('English');
  });

  it('prefers English order as nameEn, name, nameAr', () => {
    expect(localizedDisplayName({ nameAr: 'عربي', name: 'Generic', nameEn: 'English' }, 'en')).toBe('English');
    expect(localizedDisplayName({ name: 'Generic', nameAr: 'عربي' }, 'en')).toBe('Generic');
    expect(localizedDisplayName({ nameAr: 'عربي' }, 'en')).toBe('عربي');
  });

  it('returns secondary name in the opposite language when available', () => {
    expect(localizedSecondaryDisplayName({ nameAr: 'عربي', nameEn: 'English' }, 'ar')).toBe('English');
    expect(localizedSecondaryDisplayName({ nameAr: 'عربي', nameEn: 'English' }, 'en')).toBe('عربي');
  });

  it('trims values and falls back for empty sources', () => {
    expect(localizedDisplayName({ nameAr: '  عربي  ' }, 'ar')).toBe('عربي');
    expect(localizedDisplayName(null, 'ar', '-')).toBe('-');
  });
});
