import { PERMISSION_MODULES } from './constants/permissions';

/**
 * يضمن أن أي صلاحية «تشغيل» داخل قسم يملك مفتاح view في PERMISSION_MODULES
 * تُرفق دائماً بصلاحية عرض الصفحة (VIEW_*) — نفس منطق الواجهة في normalizeModuleViewAccess.
 */
export function normalizeStoredRolePermissions(perms: string[]): string[] {
  if (!Array.isArray(perms) || perms.length === 0) return [];
  const set = new Set(perms);
  for (const mod of PERMISSION_MODULES) {
    const pmap = mod.permissions as Record<string, string>;
    const viewPerm = pmap.view;
    if (!viewPerm) continue;
    const hasAnyNonView = Object.entries(pmap).some(([k, p]) => k !== 'view' && p && set.has(p));
    if (hasAnyNonView) set.add(viewPerm);
  }
  return Array.from(set);
}
