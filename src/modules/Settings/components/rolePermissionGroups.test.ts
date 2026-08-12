import { describe, expect, it } from 'vitest';
import {
  groupPermissionModules,
  type PermissionModuleGroupShape,
  type PermissionModuleShape,
} from './rolePermissionGroups';

const groups: PermissionModuleGroupShape[] = [
  { key: 'operations', labelAr: 'تشغيل', labelEn: 'Operations' },
  { key: 'settings', labelAr: 'إعدادات', labelEn: 'Settings' },
];

const modules: PermissionModuleShape[] = [
  { key: 'sales', labelAr: 'المبيعات', labelEn: 'Sales', group: 'operations', permissions: { view: 'VIEW_SALES' } },
  { key: 'users', labelAr: 'المستخدمون', labelEn: 'Users', group: 'settings', permissions: { read: 'MANAGE_USERS' } },
  { key: 'legacy', labelAr: 'قديم', labelEn: 'Legacy', group: 'unknown', permissions: { view: 'VIEW_LEGACY' } },
];

describe('groupPermissionModules', () => {
  it('groups modules for display without dropping, duplicating, or reordering permissions', () => {
    const result = groupPermissionModules(modules, groups);

    expect(result.map((entry) => entry.group.key)).toEqual(['operations', 'settings', 'other']);
    expect(result.flatMap((entry) => entry.modules.map((mod) => mod.key))).toEqual(['sales', 'users', 'legacy']);
    expect(result.flatMap((entry) => entry.modules.flatMap((mod) => Object.values(mod.permissions)))).toEqual([
      'VIEW_SALES',
      'MANAGE_USERS',
      'VIEW_LEGACY',
    ]);
  });

  it('keeps professional grouping during a cached or rolling deployment with the old API schema', () => {
    const legacyModules = modules.map(({ group: _group, ...mod }) => mod);
    const result = groupPermissionModules(legacyModules, []);

    expect(result.map((entry) => entry.group.key)).toEqual(['operations', 'settings']);
    expect(result.flatMap((entry) => entry.modules.map((mod) => mod.key))).toEqual(['sales', 'legacy', 'users']);
  });
});
