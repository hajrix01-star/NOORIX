import { normalizeOcrSupplierName } from './ocr-extraction-normalize.util';

describe('normalizeOcrSupplierName', () => {
  it('keeps clean supplier names as-is', () => {
    expect(normalizeOcrSupplierName('شركة ركن على هواك التجارية')).toBe('شركة ركن على هواك التجارية');
  });

  it('removes instruction-like narration and keeps best company candidate', () => {
    const noisy = `Corner company on your liking (combined for clarity) - using the Arabic primary as per instructions.
شركة ركن على هواك التجارية
Re-evaluating: this is the selected name`;
    expect(normalizeOcrSupplierName(noisy)).toBe('شركة ركن على هواك التجارية');
  });

  it('returns undefined when only meta text is present', () => {
    const metaOnly = 'Re-evaluating as per instructions and combined for clarity';
    expect(normalizeOcrSupplierName(metaOnly)).toBeUndefined();
  });
});
