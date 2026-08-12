import {
  PERMISSION_LEVELS,
  PERMISSION_MODULE_GROUPS,
  PERMISSION_MODULES,
  PERMISSIONS,
  SYSTEM_ROLE_SEEDS,
} from './constants/permissions';
import { normalizeStoredRolePermissions } from './permission-normalize';

describe('permission display schema compatibility', () => {
  it('represents every central permission exactly once', () => {
    const centralPermissions = Object.values(PERMISSIONS).sort();
    const displayedPermissions = PERMISSION_MODULES.flatMap((mod) => Object.values(mod.permissions));

    expect(new Set(displayedPermissions).size).toBe(displayedPermissions.length);
    expect([...displayedPermissions].sort()).toEqual(centralPermissions);
  });

  it('keeps stable module keys while presenting the approved section names', () => {
    expect(PERMISSION_MODULES.map((mod) => mod.key)).toEqual([
      'dashboard',
      'ownerDashboard',
      'sales',
      'invoices',
      'purchases',
      'suppliers',
      'vaults',
      'expenses',
      'assets',
      'ordersV4',
      'employees',
      'hr',
      'reports',
      'hajriTax',
      'chat',
      'settings',
      'users',
      'companies',
    ]);
    expect(Object.fromEntries(PERMISSION_MODULES.map((mod) => [mod.key, mod.labelAr]))).toMatchObject({
      sales: 'المبيعات اليومية',
      invoices: 'سجل الفواتير',
      suppliers: 'الموردون والتصنيفات',
      expenses: 'المصروفات والالتزامات',
      assets: 'سجل الأصول والضمان',
      ordersV4: 'الطلبات',
      employees: 'بيانات الموظفين',
      hr: 'عمليات الموارد البشرية',
      hajriTax: 'HAJRI TAX — السجل الضريبي',
    });
  });

  it('assigns every module to a declared display group and labels every permission level', () => {
    const groupKeys = new Set<string>(PERMISSION_MODULE_GROUPS.map((group) => group.key));
    expect(PERMISSION_MODULES.every((mod) => !!mod.group && groupKeys.has(mod.group))).toBe(true);

    const levelKeys = new Set(PERMISSION_MODULES.flatMap((mod) => Object.keys(mod.permissions)));
    expect([...levelKeys].filter((level) => !PERMISSION_LEVELS[level])).toEqual([]);
  });

  it('does not alter any seeded role permission set during view normalization', () => {
    for (const seed of Object.values(SYSTEM_ROLE_SEEDS)) {
      expect(new Set(normalizeStoredRolePermissions(seed.permissions))).toEqual(new Set(seed.permissions));
    }
  });
});
