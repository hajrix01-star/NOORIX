import { extractSizeFromName, findBestItemMatch } from './ocr-item-name-match.util';

describe('ocr-item-name-match packaging normalization', () => {
  it('removes Arabic packaging suffix when extracting base clean name', () => {
    const result = extractSizeFromName('تفاحتين النخله 500 جرام شد 12');
    expect(result.cleanName).toBe('تفاحتين النخله');
    expect(result.size).toBe('500');
    expect(result.sizeUnit).toBe('جرام');
  });

  it('removes packaging suffix even without explicit size', () => {
    const result = extractSizeFromName('فحم شيشني شد 10');
    expect(result.cleanName).toBe('فحم شيشني');
    expect(result.size).toBeNull();
    expect(result.sizeUnit).toBeNull();
  });

  it('matches item despite packaging token in OCR name', () => {
    const candidates = [
      {
        id: 'item-1',
        nameAr: 'تفاحتين النخله',
        nameEn: null,
        hasSizes: true,
        aliases: [],
      },
    ];
    const result = findBestItemMatch('تفاحتين النخله 500 جرام شد 12', candidates);
    expect(result).not.toBeNull();
    expect(result?.item.id).toBe('item-1');
    expect((result?.score ?? 0)).toBeGreaterThanOrEqual(0.9);
  });
});
