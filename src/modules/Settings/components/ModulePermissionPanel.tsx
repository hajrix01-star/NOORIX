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
  /** داخل accordion — بدون شريط ملخص القسم (موجود في رأس الـ accordion) */
  embedded?: boolean;
};

function PermRow({
  perm,
  label,
  checked,
  disabled,
  embedded,
  onToggle,
}: {
  perm: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  embedded?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-3 min-h-[44px] transition-colors',
        embedded
          ? cn(
              'rounded-md px-2 py-2',
              checked ? 'bg-[var(--noorix-blue-7)]' : 'hover:bg-noorix-bg-muted',
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            )
          : cn(
              'rounded-lg border border-noorix-border px-3 py-2 bg-noorix-surface',
              checked && 'border-noorix-blue bg-[var(--noorix-blue-7)]',
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-noorix-bg-muted',
            ),
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
  embedded,
  onToggleAll,
  children,
}: {
  title: string;
  full: boolean;
  partial: boolean;
  disabled?: boolean;
  isAr: boolean;
  embedded?: boolean;
  onToggleAll: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        embedded
          ? 'pt-3 border-t border-noorix-border first:border-t-0 first:pt-0'
          : 'noorix-surface-card p-4 gap-3',
      )}
    >
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1 sm:gap-2">
        {children}
      </div>
    </div>
  );
}

const PERM_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1 sm:gap-2';

export default function ModulePermissionPanel({
  mod,
  levels,
  permissions,
  onChange,
  disabled,
  isAr,
  embedded = false,
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
        embedded={embedded}
        onToggle={() => togglePerm(perm)}
      />
    );
  };

  const moduleToolbar = !embedded ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="m-0 text-[13px] text-noorix-muted">
        {isAr
          ? `${moduleSelected} / ${moduleCount} صلاحية${mod.key === 'chat' ? ' في المحادثة' : ''}`
          : `${moduleSelected} / ${moduleCount} ${mod.key === 'chat' ? 'chat ' : ''}permissions`}
      </p>
      <Button size="sm" disabled={disabled} onClick={() => toggleModuleAll(!moduleFull)}>
        {moduleFull
          ? (isAr
              ? mod.key === 'chat' ? 'إلغاء كل المحادثة' : 'إلغاء القسم'
              : mod.key === 'chat' ? 'Clear all chat' : 'Clear module')
          : (isAr
              ? mod.key === 'chat' ? 'تحديد كل المحادثة' : 'تحديد القسم'
              : mod.key === 'chat' ? 'Select all chat' : 'Select module')}
      </Button>
    </div>
  ) : null;

  if (mod.key === 'chat') {
    const groups = CHAT_PERMISSION_GROUPS.map((group) => {
      const keys = resolveGroupLevelKeys(mod, group);
      if (!keys.length) return null;
      const permsInGroup = keys.map((k) => mod.permissions[k]);
      const full = isGroupFull(mod, group, permissions);
      const partial = isGroupPartial(mod, group, permissions);

      if (group.singleToggle) {
        const title = isAr ? group.labelAr : group.labelEn;
        return (
          <div
            key={group.id}
            className={cn(
              embedded
                ? 'pt-3 border-t border-noorix-border first:border-t-0 first:pt-0'
                : 'noorix-surface-card p-4',
            )}
          >
            <PermRow
              perm={permsInGroup.join(',')}
              label={title}
              checked={full}
              disabled={disabled}
              embedded={embedded}
              onToggle={() => {
                if (full) setPerms([], permsInGroup);
                else setPerms(permsInGroup, []);
              }}
            />
            {partial && !full && (
              <p className="m-0 mt-2 text-[11px] text-noorix-muted">
                {isAr ? 'مفعّل جزئياً — اضغط لتفعيل كل الأسئلة' : 'Partially enabled — click to enable all FAQ'}
              </p>
            )}
          </div>
        );
      }

      return (
        <GroupBlock
          key={group.id}
          title={isAr ? group.labelAr : group.labelEn}
          full={full}
          partial={partial}
          disabled={disabled}
          isAr={isAr}
          embedded={embedded}
          onToggleAll={(on) => {
            if (on) setPerms(permsInGroup, []);
            else setPerms([], permsInGroup);
          }}
        >
          {keys.map((k) => renderPermKey(k))}
        </GroupBlock>
      );
    });

    if (embedded) {
      return <div className="flex flex-col">{groups}</div>;
    }

    return (
      <div className="flex flex-col gap-3">
        {moduleToolbar}
        {groups}
      </div>
    );
  }

  const levelKeys = Object.keys(mod.permissions);
  const permGrid = (
    <div className={PERM_GRID_CLASS}>
      {levelKeys.map((k) => renderPermKey(k))}
    </div>
  );

  if (embedded) {
    return permGrid;
  }

  return (
    <div className="flex flex-col gap-3">
      {moduleToolbar}
      <div className="noorix-surface-card p-4">{permGrid}</div>
    </div>
  );
}
