import { describe, expect, it } from 'vitest';
import { dashboardDisplayName } from './dashboardDisplayName';

describe('dashboardDisplayName', () => {
  it('uses Arabic display priority', () => {
    expect(dashboardDisplayName({ nameAr: 'عربي', name: 'Common', nameEn: 'English' }, 'ar')).toBe('عربي');
    expect(dashboardDisplayName({ name: 'Common', nameEn: 'English' }, 'ar')).toBe('Common');
  });

  it('uses English display priority', () => {
    expect(dashboardDisplayName({ nameAr: 'عربي', name: 'Common', nameEn: 'English' }, 'en')).toBe('English');
    expect(dashboardDisplayName({ nameAr: 'عربي', name: 'Common' }, 'en')).toBe('Common');
  });
});
