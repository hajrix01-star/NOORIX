import {
  directoryIdentitySimilarity,
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

  it('does not confuse the Ministry of Labor alias with the Ministry of Justice', () => {
    expect(directoryTextSimilarity('وزارة العمل', 'وزارة العدل')).toBeGreaterThan(0.68);
    expect(directoryIdentitySimilarity('وزارة العمل', 'وزارة العدل')).toBe(0);
  });

  it('allows identity matching when a distinctive entity word is shared or misspelled', () => {
    expect(
      directoryIdentitySimilarity(
        'السعودية للكهرباء',
        'الشركة السعودية للكهرباء',
      ),
    ).toBeGreaterThan(0.68);
    expect(
      directoryIdentitySimilarity(
        'وزارة العدل',
        'وزاره العدل',
      ),
    ).toBe(1);
  });

  it('does not confuse short brand names with similar government platform words', () => {
    expect(directoryIdentitySimilarity('سلام', 'سلامة')).toBe(0);
  });

  it('protects SHAMI TAX regardless of spacing or case', () => {
    expect(isShamiTaxWorkspace({ nameEn: 'SHAMI TAX' })).toBe(true);
    expect(isShamiTaxWorkspace({ nameAr: 'ShamiTax' })).toBe(true);
    expect(isShamiTaxWorkspace({ nameAr: 'المعلم الشامي' })).toBe(false);
  });
});
