import { resolveProductSection } from './orders-staff-sections.util';

describe('resolveProductSection', () => {
  it('uses the first configured product section', () => {
    expect(resolveProductSection({ sections: ['cold', 'hot'] })).toBe('cold');
  });

  it('falls back to the general section when product sections are missing', () => {
    expect(resolveProductSection(null)).toBe('عام');
    expect(resolveProductSection({ sections: [] })).toBe('عام');
  });
});
