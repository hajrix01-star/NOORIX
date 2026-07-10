import { describe, expect, it } from 'vitest';
import {
  buildSettingsTabs,
  filterActiveSettingsCompanies,
  filterSettingsTabs,
  getSettingsActiveLabel,
  getSettingsTabIds,
} from './settingsScreenModel';
import type { TranslationFn } from './settingsTypes';

const t: TranslationFn = (key) => key;

describe('settingsScreenModel', () => {
  it('builds stable settings tab ids', () => {
    const tabs = buildSettingsTabs(t);

    expect(getSettingsTabIds(tabs)).toEqual([
      'companies',
      'tax',
      'users',
      'roles',
      'backup',
      'ai',
      'branding',
    ]);
  });

  it('filters permission-gated tabs for non-owner users', () => {
    const tabs = buildSettingsTabs(t);

    expect(filterSettingsTabs(tabs, 'cashier', ['MANAGE_USERS']).map((tab) => tab.id)).toEqual(['users']);
  });

  it('keeps all tabs for owner role and resolves labels', () => {
    const tabs = filterSettingsTabs(buildSettingsTabs(t), 'owner', []);

    expect(tabs).toHaveLength(7);
    expect(getSettingsActiveLabel(tabs, 'roles')).toBe('rolesTab');
  });

  it('filters archived companies out of active settings companies', () => {
    expect(
      filterActiveSettingsCompanies([
        { id: 'co-1', nameAr: 'Active' },
        { id: 'co-2', nameAr: 'Archived', isArchived: true },
      ]),
    ).toEqual([{ id: 'co-1', nameAr: 'Active' }]);
  });
});
