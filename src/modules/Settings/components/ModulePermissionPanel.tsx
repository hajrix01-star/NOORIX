/**
 * ModulePermissionPanel — صلاحيات قسم واحد (بدون جدول 34 عمود).
 * المحادثة: مجموعات HR / FAQ / مصروفات.
 */
import React from 'react';
import { Button, cn } from '../../../ui';
import {
  CHAT_PERMISSION_GROUPS,
  getModulePermValues,
  isGroupFull,
  isGroupPartial,
  isModuleFull,
  resolveGroupLevelKeys,
  type PermissionModuleShape,
} from './rolePermissionGroups';

type LevelsMap = Record<string, { ar: string; en: string }>;

type ModulePermissionPanelProps = {
  mod: PermissionModuleShape;
  levels: LevelsMap;
  permissions: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  isAr: boolean;
};

function PermRow({
  perm,
  label,
  checked,
  disabled,
  onToggle,
}: {
  perm: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 min-h-[44px] rounded-lg border border-noorix-border px-3 py-2',
        'bg-noorix-surface transition-colors',
        checked && 'border-noorix-blue bg-[var(--noorix-blue-7)]',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-noorix-bg-muted',
      )}
    >
      <input
        type="checkbox"
        className="shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <span className="text-[13px] text-noorix-text leading-snug">{label}</span>
    </label>
  );
}

function GroupBlock({
  title,
  full,
  partial,
  disabled,
  isAr,
  onToggleAll,
  children,
}: {
  title: string;
  full: boolean;
  partial: boolean;
  disabled?: boolean;
  isAr: boolean;
  onToggleAll: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="noorix-surface-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="m-0 text-[14px] font-bold text-noorix-text">{title}</h5>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => onToggleAll(!(full && !partial))}
        >
          {full && !partial
            ? (isAr ? 'إلغاء المجموعة' : 'Clear group')
            : (isAr ? 'تحديد المجموعة' : 'Select group')}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {children}
      </div>
    </div>
  );
}

export default function ModulePermissionPanel({
  mod,
  levels,
  permissions,
  onChange,
  disabled,
  isAr,
}: ModulePermissionPanelProps) {
  const isChecked = (perm: string) => permissions.includes(perm);

  const togglePerm = (perm: string) => {
    if (disabled || !perm) return;
    onChange(
      isChecked(perm)
        ? permissions.filter((p) => p !== perm)
        : [...permissions, perm],
    );
  };

  const setPerms = (toAdd: string[], toRemove: string[]) => {
    if (disabled) return;
    const removeSet = new Set(toRemove);
    const next = permissions.filter((p) => !removeSet.has(p));
    for (const p of toAdd) {
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
  };

  const toggleModuleAll = (on: boolean) => {
    const vals = getModulePermValues(mod);
    if (on) {
      onChange([...new Set([...permissions, ...vals])]);
    } else {
      const drop = new Set(vals);
      onChange(permissions.filter((p) => !drop.has(p)));
    }
  };

  const moduleFull = isModuleFull(mod, permissions);
  const moduleCount = getModulePermValues(mod).length;
  const moduleSelected = getModulePermValues(mod).filter((p) => permissions.includes(p)).length;

  const renderPermKey = (levelKey: string) => {
    const perm = mod.permissions[levelKey];
    if (!perm) return null;
    const lvl = levels[levelKey];
    const label = lvl ? (isAr ? lvl.ar : lvl.en) : levelKey;
    return (
      <PermRow
        key={levelKey}
        perm={perm}
        label={label}
        checked={isChecked(perm)}
        disabled={disabled}
        onToggle={() => togglePerm(perm)}
      />
    );
  };

  if (mod.key === 'chat') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[13px] text-noorix-muted">
            {isAr
              ? `${moduleSelected} / ${moduleCount} صلاحية في المحادثة`
              : `${moduleSelected} / ${moduleCount} chat permissions`}
          </p>
          <Button size="sm" disabled={disabled} onClick={() => toggleModuleAll(!moduleFull)}>
            {moduleFull
              ? (isAr ? 'إلغاء كل المحادثة' : 'Clear all chat')
              : (isAr ? 'تحديد كل المحادثة' : 'Select all chat')}
          </Button>
        </div>

        {CHAT_PERMISSION_GROUPS.map((group) => {
          const keys = resolveGroupLevelKeys(mod, group);
          if (!keys.length) return null;
          const permsInGroup = keys.map((k) => mod.permissions[k]);
          const full = isGroupFull(mod, group, permissions);
          const partial = isGroupPartial(mod, group, permissions);

          return (
            <GroupBlock
              key={group.id}
              title={isAr ? group.labelAr : group.labelEn}
              full={full}
              partial={partial}
              disabled={disabled}
              isAr={isAr}
              onToggleAll={(on) => {
                if (on) setPerms(permsInGroup, []);
                else setPerms([], permsInGroup);
              }}
            >
              {keys.map((k) => renderPermKey(k))}
            </GroupBlock>
          );
        })}
      </div>
    );
  }

  const levelKeys = Object.keys(mod.permissions);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] text-noorix-muted">
          {isAr
            ? `${moduleSelected} / ${moduleCount} صلاحية`
            : `${moduleSelected} / ${moduleCount} permissions`}
        </p>
        <Button size="sm" disabled={disabled} onClick={() => toggleModuleAll(!moduleFull)}>
          {moduleFull
            ? (isAr ? 'إلغاء القسم' : 'Clear module')
            : (isAr ? 'تحديد القسم' : 'Select module')}
        </Button>
      </div>

      <div className="noorix-surface-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {levelKeys.map((k) => renderPermKey(k))}
        </div>
      </div>
    </div>
  );
}
