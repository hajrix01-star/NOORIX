import {
  buildCatalogTranslationPrompt,
  normalizeCatalogTranslations,
} from './gemini-catalog-translation.util';

describe('gemini catalog translation', () => {
  const inputs = [{
    id: 'p1',
    nameAr: '\u0645\u0646\u0638\u0641 \u0623\u0631\u0636\u064a\u0627\u062a',
    categoryAr: '\u0646\u0638\u0627\u0641\u0629',
    unit: '\u0639\u0628\u0648\u0629',
    productType: 'order',
  }];

  it('includes restaurant context without losing item context', () => {
    const prompt = buildCatalogTranslationPrompt(inputs);
    expect(prompt).toContain('restaurant catalog');
    expect(prompt).toContain('\u0645\u0646\u0638\u0641 \u0623\u0631\u0636\u064a\u0627\u062a');
    expect(prompt).toContain('\u0646\u0638\u0627\u0641\u0629');
  });

  it('accepts only known ids and normalizes confidence', () => {
    const result = normalizeCatalogTranslations([
      {
        id: 'p1',
        suggestedNameEn: '  Floor   Cleaner  ',
        classification: 'cleaning',
        confidence: 1.4,
        needsReview: false,
      },
      { id: 'unknown', suggestedNameEn: 'Wrong' },
    ], inputs);

    expect(result).toEqual([{
      id: 'p1',
      suggestedNameEn: 'Floor Cleaner',
      classification: 'cleaning',
      confidence: 1,
      needsReview: false,
    }]);
  });
});
