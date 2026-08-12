import { hasAnyOfPermissions, hasPermission } from '../../constants/permissions';
import type {
  SettingsCompany,
  SettingsTabDefinition,
  SettingsTabId,
  TranslationFn,
} from './settingsTypes';

export function buildSettingsTabs(t: TranslationFn): SettingsTabDefinition[] {
  return [
    { id: 'companies', label: t('companiesTab'), permission: 'MANAGE_COMPANIES' },
    { id: 'tax', label: t('taxTab'), permission: ['MANAGE_TAX_SETTINGS', 'MANAGE_SETTINGS'] },
    { id: 'users', label: t('usersTab'), permission: 'MANAGE_USERS' },
    { id: 'roles', label: t('rolesTab'), permission: 'MANAGE_SETTINGS' },
    { id: 'backup', label: t('backupTab'), permission: 'MANAGE_SETTINGS' },
    { id: 'ai', label: t('aiTab'), permission: 'MANAGE_SETTINGS' },
    { id: 'branding', label: t('brandingTab'), permission: 'MANAGE_SETTINGS' },
  ];
}

export function filterSettingsTabs(
  tabs: SettingsTabDefinition[],
  userRole: string | null | undefined,
  userPermissions: readonly string[],
) {
  return tabs.filter((tab) => {
    if (!tab.permission) return true;
    return Array.isArray(tab.permission)
      ? hasAnyOfPermissions(userRole, tab.permission, userPermissions)
      : hasPermission(userRole, tab.permission, userPermissions);
  });
}

export function getSettingsTabIds(tabs: SettingsTabDefinition[]): SettingsTabId[] {
  return tabs.map((tab) => tab.id);
}

export function getSettingsTabItems(tabs: SettingsTabDefinition[]) {
  return tabs.map((tab) => ({ id: tab.id, label: tab.label }));
}

export function getSettingsActiveLabel(tabs: SettingsTabDefinition[], activeTab: string) {
  return tabs.find((tab) => tab.id === activeTab)?.label || '';
}

export function filterActiveSettingsCompanies(companies: SettingsCompany[]) {
  return companies.filter((company) => !company.isArchived);
}
