/**
 * RolePermissionsAccordion — كل الأقسام في scroll واحد (بدون sidebar).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, cn } from '../../../ui';
import ModulePermissionPanel from './ModulePermissionPanel';
import {
  countModuleSelected,
  getModulePermValues,
  groupPermissionModules,
  isModuleFull,
  isModulePartial,
  type PermissionModuleShape,
  type PermissionModuleGroupShape,
} from './rolePermissionGroups';

type RolePermissionsAccordionProps = {
  modules: PermissionModuleShape[];
  groups: PermissionModuleGroupShape[];
  levels: Record<string, { ar: string; en: string }>;
  permissions: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  isAr: boolean;
  open: boolean;
};

function moduleToggleAll(
  mod: PermissionModuleShape,
  permissions: string[],
  on: boolean,
): string[] {
  const vals = getModulePermValues(mod);
  if (on) return [...new Set([...permissions, ...vals])];
  const drop = new Set(vals);
  return permissions.filter((p) => !drop.has(p));
}

export default function RolePermissionsAccordion({
  modules,
  groups,
  levels,
  permissions,
  onChange,
  disabled,
  isAr,
  open,
}: RolePermissionsAccordionProps) {
  const keysWithSelection = useMemo(
    () =>
      modules
        .filter((m) => countModuleSelected(m, permissions) > 0)
        .map((m) => m.key),
    [modules, permissions],
  );

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const groupedModules = useMemo(
    () => groupPermissionModules(modules, groups),
    [groups, modules],
  );

  useEffect(() => {
    if (!open) {
      setOpenKeys(new Set());
      return;
    }
    setOpenKeys((prev) => {
      const next = new Set(prev);
      for (const key of keysWithSelection) next.add(key);
      return next;
    });
  }, [open, keysWithSelection.join('|')]);

  const toggleSection = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="noorix-surface-card overflow-hidden min-w-0 rounded-t-none border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noorix-border bg-noorix-bg-muted px-3 py-2 sm:px-4">
        <h3 className="m-0 text-[14px] font-bold text-noorix-text">
          {isAr ? 'صلاحيات الأقسام' : 'Module permissions'}
        </h3>
        <div
          className="flex flex-nowrap items-center gap-2 shrink-0"
          aria-label={isAr ? 'فتح وطي الأقسام' : 'Expand and collapse sections'}
        >
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="shrink-0 whitespace-nowrap min-h-[36px]"
            onClick={() => setOpenKeys(new Set(modules.map((m) => m.key)))}
          >
            {isAr ? 'فتح الكل' : 'Expand all'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="shrink-0 whitespace-nowrap min-h-[36px]"
            onClick={() => setOpenKeys(new Set())}
          >
            {isAr ? 'طي الكل' : 'Collapse all'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        {groupedModules.map(({ group, modules: groupModules }, groupIndex) => (
          <section key={group.key} className={cn(groupIndex > 0 && 'border-t border-noorix-border')}>
            <div className="bg-noorix-bg-muted px-3 py-2 sm:px-4">
              <h4 className="m-0 text-[12px] font-extrabold text-noorix-muted uppercase tracking-wide">
                {isAr ? group.labelAr : group.labelEn}
              </h4>
            </div>
            <div className="flex flex-col">
        {groupModules.map((mod, index) => {
          const selected = countModuleSelected(mod, permissions);
          const total = getModulePermValues(mod).length;
          const isOpen = openKeys.has(mod.key);
          const full = isModuleFull(mod, permissions);
          const partial = isModulePartial(mod, permissions);
          const label = isAr ? mod.labelAr : mod.labelEn;

          return (
            <section
              key={mod.key}
              className={cn(index > 0 && 'border-t border-noorix-border')}
            >
              <div className="flex items-stretch gap-2 p-2 sm:px-3 sm:py-2">
                <Button
                  variant="raw"
                  type="button"
                  className={cn(
                    'flex flex-1 min-w-0 items-center gap-3 min-h-[44px] rounded-lg px-3 py-2 text-start',
                    'hover:bg-noorix-bg-muted transition-colors',
                    isOpen && 'bg-[var(--noorix-blue-7)]',
                  )}
                  onClick={() => toggleSection(mod.key)}
                  aria-expanded={isOpen}
                >
                  <span className="text-[16px] shrink-0">{mod.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-bold text-noorix-text truncate">
                      {label}
                    </span>
                    {(mod.descriptionAr || mod.descriptionEn) && (
                      <span className="block text-[11px] text-noorix-muted font-normal truncate">
                        {isAr ? mod.descriptionAr : mod.descriptionEn}
                      </span>
                    )}
                    <span className="block text-[11px] text-noorix-muted font-normal">
                      {selected}/{total}
                      {full && !partial
                        ? (isAr ? ' · كامل' : ' · full')
                        : partial
                          ? (isAr ? ' · جزئي' : ' · partial')
                          : ''}
                    </span>
                  </span>
                  <span className="text-noorix-muted text-[12px] shrink-0" aria-hidden>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  className="shrink-0 self-center min-h-[44px]"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onChange(moduleToggleAll(mod, permissions, !full));
                    setOpenKeys((prev) => new Set(prev).add(mod.key));
                  }}
                >
                  {full ? (isAr ? 'إلغاء' : 'Clear') : (isAr ? 'الكل' : 'All')}
                </Button>
              </div>

              {isOpen && (
                <div className="border-t border-noorix-border bg-noorix-bg-muted/40 px-3 pb-3 pt-2 sm:px-4">
                  <ModulePermissionPanel
                    mod={mod}
                    levels={levels}
                    permissions={permissions}
                    onChange={onChange}
                    disabled={disabled}
                    isAr={isAr}
                    embedded
                  />
                </div>
              )}
            </section>
          );
        })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
