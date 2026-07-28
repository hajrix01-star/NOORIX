import {
  directoryTextSimilarity,
  isShamiTaxWorkspace,
  matchesDirectorySearch,
  normalizeDirectoryText,
} from './supplier-directory-search.util';

describe('supplier directory search', () => {
  it('normalizes Arabic letter variants and punctuation', () => {
    expect(normalizeDirectoryText('  هيئةُ الزكاة والضريبة  ')).toBe('هييه الزكاه والضريبه');
  });

  it('finds full, partial, alias, and similar names', () => {
    const values = [
      'المؤسسة العامة للتأمينات الاجتماعية',
      'General Organization for Social Insurance',
      'GOSI',
      'التأمينات',
    ];
    expect(matchesDirectorySearch('التأمينات', values)).toBe(true);
    expect(matchesDirectorySearch('gosi', values)).toBe(true);
    expect(matchesDirectorySearch('المؤسسه للتامينات', values)).toBe(true);
    expect(matchesDirectorySearch('التامينات الاجتماع', values)).toBe(true);
    expect(matchesDirectorySearch('شركة مياه خاصة', values)).toBe(false);
  });

  it('keeps similarity bounded', () => {
    expect(directoryTextSimilarity('السعودية للكهرباء', 'الشركة السعودية للكهرباء')).toBeGreaterThan(0.6);
    expect(directoryTextSimilarity('الجوازات', 'شركة المياه الوطنية')).toBeLessThan(0.48);
  });

  it('protects SHAMI TAX regardless of spacing or case', () => {
    expect(isShamiTaxWorkspace({ nameEn: 'SHAMI TAX' })).toBe(true);
    expect(isShamiTaxWorkspace({ nameAr: 'ShamiTax' })).toBe(true);
    expect(isShamiTaxWorkspace({ nameAr: 'المعلم الشامي' })).toBe(false);
  });
});
