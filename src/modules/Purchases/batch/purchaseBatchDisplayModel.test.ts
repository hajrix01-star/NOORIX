import { describe, expect, it } from 'vitest';
import { purchaseBatchCategoryLabel, purchaseBatchDisplayName } from './purchaseBatchDisplayModel';

describe('purchaseBatchDisplayModel', () => {
  it('uses Arabic display order', () => {
    expect(purchaseBatchDisplayName({ nameAr: 'عربي', name: 'عام', nameEn: 'English' }, 'ar')).toBe('عربي');
    expect(purchaseBatchDisplayName({ name: 'عام', nameEn: 'English' }, 'ar')).toBe('عام');
  });

  it('uses English display order', () => {
    expect(purchaseBatchDisplayName({ nameAr: 'عربي', name: 'Generic', nameEn: 'English' }, 'en')).toBe('English');
    expect(purchaseBatchDisplayName({ nameAr: 'عربي', name: 'Generic' }, 'en')).toBe('Generic');
  });

  it('combines category icon with localized label', () => {
    expect(purchaseBatchCategoryLabel({ icon: '•', nameAr: 'مشتريات' }, 'ar')).toBe('• مشتريات');
  });
});
