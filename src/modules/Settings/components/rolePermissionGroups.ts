/**
 * تجميع صلاحيات المحادثة في واجهة الأدوار — كل مجموعة toggle مستقل.
 */

export type ChatPermissionGroup = {
  id: string;
  labelAr: string;
  labelEn: string;
  /** مفاتيح داخل mod.permissions (ليس قيم PERMISSIONS) */
  levelKeys: string[];
  /** زر/checkbox واحد للمجموعة — بدون تفصيل الصلاحيات الفرعية */
  singleToggle?: boolean;
};

export const CHAT_PERMISSION_GROUPS: ChatPermissionGroup[] = [
  {
    id: 'core',
    labelAr: 'أساسي — دخول المحادثة',
    labelEn: 'Core — chat access',
    levelKeys: ['view', 'read'],
  },
  {
    id: 'hr',
    labelAr: 'أوامر HR (سلف · إجازات · خصومات · زيادات · موظف)',
    labelEn: 'HR commands',
    levelKeys: ['chatAdv', 'chatLeave', 'chatDed', 'chatInc', 'chatEmp'],
  },
  {
    id: 'expense',
    labelAr: 'أوامر المصروفات الثابتة',
    labelEn: 'Fixed expense commands',
    levelKeys: ['chatExpAdd', 'chatExpPay', 'chatExpEdit'],
  },
  {
    id: 'faq',
    labelAr: 'أسئلة جاهزة',
    labelEn: 'FAQ ready questions',
    singleToggle: true,
    levelKeys: [
      'chatFaq',
      'faqSalesYear',
      'faqVaults',
      'faqPnl',
      'faqLoadSales',
      'faqCompare',
      'faqInvCount',
      'faqSupCount',
      'faqEmpCount',
      'faqHelp',
    ],
  },
];

export type PermissionModuleShape = {
  key: string;
  labelAr: string;
  labelEn: string;
  icon?: string;
  permissions: Record<string, string>;
};

export function getModulePermValues(mod: PermissionModuleShape): string[] {
  return Object.values(mod.permissions).filter(Boolean);
}

export function countModuleSelected(mod: PermissionModuleShape, selected: string[]): number {
  return getModulePermValues(mod).filter((p) => selected.includes(p)).length;
}

export function isModuleFull(mod: PermissionModuleShape, selected: string[]): boolean {
  const vals = getModulePermValues(mod);
  return vals.length > 0 && vals.every((p) => selected.includes(p));
}

export function isModulePartial(mod: PermissionModuleShape, selected: string[]): boolean {
  const n = countModuleSelected(mod, selected);
  const total = getModulePermValues(mod).length;
  return n > 0 && n < total;
}

/** مفاتيح المجموعة التي لها perm فعلي في هذا القسم */
export function resolveGroupLevelKeys(
  mod: PermissionModuleShape,
  group: ChatPermissionGroup,
): string[] {
  return group.levelKeys.filter((k) => mod.permissions[k]);
}

export function isGroupFull(
  mod: PermissionModuleShape,
  group: ChatPermissionGroup,
  selected: string[],
): boolean {
  const keys = resolveGroupLevelKeys(mod, group);
  if (!keys.length) return false;
  return keys.every((k) => selected.includes(mod.permissions[k]));
}

export function isGroupPartial(
  mod: PermissionModuleShape,
  group: ChatPermissionGroup,
  selected: string[],
): boolean {
  const keys = resolveGroupLevelKeys(mod, group);
  const n = keys.filter((k) => selected.includes(mod.permissions[k])).length;
  return n > 0 && n < keys.length;
}
