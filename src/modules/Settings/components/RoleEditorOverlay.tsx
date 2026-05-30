/**
 * RoleEditorOverlay — محرّر دور بشاشة كاملة (بدلاً drawer 720px).
 * يسار: قائمة الأقسام | يمين: صلاحيات القسم النشط | أعلى: presets.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, cn } from '../../../ui';
import { normalizeModuleViewAccess } from '../../../constants/permissions';
import { useIsMobile640 } from '../../../hooks/useMediaQuery';
import ModulePermissionPanel from './ModulePermissionPanel';
import { ROLE_PRESETS } from './rolePermissionPresets';
import {
  countModuleSelected,
  getModulePermValues,
  isModuleFull,
  isModulePartial,
  type PermissionModuleShape,
} from './rolePermissionGroups';

export type RoleEditorFormState = {
  name?: string;
  nameAr?: string;
  description?: string;
  permissions: string[];
};

export type RoleEditorOverlayProps = {
  open: boolean;
  mode: 'create' | 'edit';
  title: string;
  isAr: boolean;
  isSystem?: boolean;
  form: RoleEditorFormState;
  onFormChange: (patch: Partial<RoleEditorFormState>) => void;
  modules: PermissionModuleShape[];
  levels: Record<string, { ar: string; en: string }>;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving: boolean;
  isDeleting?: boolean;
  saveLabel: string;
  cancelLabel: string;
  closeLabel: string;
  deleteLabel?: string;
};

export default function RoleEditorOverlay({
  open,
  mode,
  title,
  isAr,
  isSystem,
  form,
  onFormChange,
  modules,
  levels,
  onClose,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  saveLabel,
  cancelLabel,
  closeLabel,
  deleteLabel,
}: RoleEditorOverlayProps) {
  const isMobile = useIsMobile640();
  const [activeModuleKey, setActiveModuleKey] = useState('dashboard');

  const totalPerms = useMemo(
    () => modules.flatMap((m) => getModulePermValues(m)).length,
    [modules],
  );

  const activeMod = useMemo(
    () => modules.find((m) => m.key === activeModuleKey) || modules[0],
    [modules, activeModuleKey],
  );

  useEffect(() => {
    if (!open || !modules.length) return;
    if (!modules.some((m) => m.key === activeModuleKey)) {
      setActiveModuleKey(modules[0].key);
    }
  }, [open, modules, activeModuleKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isSaving, onClose]);

  if (!open || !activeMod) return null;

  const applyPreset = (presetId: string) => {
    const preset = ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const msg = isAr
      ? 'استبدال الصلاحيات الحالية بقالب الدور؟'
      : 'Replace current permissions with this preset?';
    if (form.permissions.length > 0 && !window.confirm(msg)) return;
    onFormChange({
      permissions: normalizeModuleViewAccess(modules, preset.permissions),
    });
  };

  const moduleNavItem = (mod: PermissionModuleShape) => {
    const selected = countModuleSelected(mod, form.permissions);
    const total = getModulePermValues(mod).length;
    const active = mod.key === activeModuleKey;
    const full = isModuleFull(mod, form.permissions);
    const partial = isModulePartial(mod, form.permissions);

    return (
      <Button
        key={mod.key}
        variant="raw"
        type="button"
        className={cn(
          'w-full justify-start gap-2 rounded-lg px-3 py-2.5 min-h-[44px] text-start',
          'border border-transparent transition-colors',
          active && 'border-noorix-blue bg-[var(--noorix-blue-7)] text-noorix-blue font-bold',
          !active && 'text-noorix-text hover:bg-noorix-bg-muted',
        )}
        onClick={() => setActiveModuleKey(mod.key)}
      >
        <span className="text-[15px] shrink-0">{mod.icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] truncate">{isAr ? mod.labelAr : mod.labelEn}</span>
          <span className="block text-[11px] text-noorix-muted font-normal">
            {selected}/{total}
            {full && !partial ? (isAr ? ' · كامل' : ' · full') : partial ? (isAr ? ' · جزئي' : ' · partial') : ''}
          </span>
        </span>
      </Button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--nx-z-lightbox,3000)] flex flex-col bg-[var(--noorix-bg-page)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shrink-0 border-b border-noorix-border bg-noorix-surface px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={isSaving}>
            ← {closeLabel}
          </Button>
          <h2 className="m-0 text-[18px] font-bold text-noorix-text flex-1 min-w-0 truncate">
            {title}
          </h2>
          {isSystem && (
            <span className="rounded-lg bg-noorix-bg-muted text-noorix-muted font-bold py-px px-2 text-[10px]">
              {isAr ? 'دور نظام' : 'System role'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[12px] text-noorix-muted font-medium shrink-0">
            {isAr ? 'قوالب جاهزة:' : 'Presets:'}
          </span>
          {ROLE_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() => applyPreset(p.id)}
            >
              {isAr ? p.labelAr : p.labelEn}
            </Button>
          ))}
        </div>

        {mode === 'create' && (
          <div className="grid gap-3 mb-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <Input
              type="text"
              label={isAr ? 'اسم الدور (إنجليزي) *' : 'Role name (EN) *'}
              value={form.name || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFormChange({ name: e.target.value })
              }
              placeholder="warehouse_manager"
              required
            />
            <Input
              type="text"
              label={isAr ? 'اسم الدور (عربي)' : 'Role name (AR)'}
              value={form.nameAr || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFormChange({ nameAr: e.target.value })
              }
              placeholder={isAr ? 'مدير المستودع' : 'Warehouse manager'}
            />
            <Input
              type="text"
              label={isAr ? 'الوصف' : 'Description'}
              value={form.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFormChange({ description: e.target.value })
              }
            />
          </div>
        )}

        {mode === 'edit' && (
          <div className="grid gap-3 mb-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <Input
              type="text"
              label={isAr ? 'اسم الدور (عربي)' : 'Role name (AR)'}
              value={form.nameAr || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFormChange({ nameAr: e.target.value })
              }
            />
            <Input
              type="text"
              label={isAr ? 'الوصف' : 'Description'}
              value={form.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onFormChange({ description: e.target.value })
              }
            />
          </div>
        )}

        <p className="m-0 text-[12px] text-noorix-muted">
          {isAr
            ? `${form.permissions.length} / ${totalPerms} صلاحية محددة — عدّل قسماً واحداً في كل مرة`
            : `${form.permissions.length} / ${totalPerms} permissions selected — edit one module at a time`}
        </p>
      </header>

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row">
        {!isMobile && (
          <aside className="hidden md:flex md:w-60 lg:w-72 shrink-0 flex-col gap-1 min-h-0 border-e border-noorix-border bg-noorix-surface p-3 overflow-y-auto overscroll-contain">
            {modules.map(moduleNavItem)}
          </aside>
        )}

        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 lg:p-6 bg-[var(--noorix-bg-page)]">
          {isMobile && (
            <div className="mb-4">
              <Input
                type="select"
                label={isAr ? 'القسم' : 'Module'}
                value={activeModuleKey}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setActiveModuleKey(e.target.value)
                }
              >
                {modules.map((mod) => (
                  <option key={mod.key} value={mod.key}>
                    {mod.icon} {isAr ? mod.labelAr : mod.labelEn} (
                    {countModuleSelected(mod, form.permissions)}/{getModulePermValues(mod).length})
                  </option>
                ))}
              </Input>
            </div>
          )}

          <div className="mb-3">
            <h3 className="m-0 text-[16px] font-bold text-noorix-text flex items-center gap-2">
              <span>{activeMod.icon}</span>
              {isAr ? activeMod.labelAr : activeMod.labelEn}
            </h3>
          </div>

          <ModulePermissionPanel
            mod={activeMod}
            levels={levels}
            permissions={form.permissions}
            onChange={(perms) => onFormChange({ permissions: perms })}
            disabled={isSaving}
            isAr={isAr}
          />
        </main>
      </div>

      <footer className="shrink-0 border-t border-noorix-border bg-noorix-surface px-4 py-3 lg:px-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} disabled={isSaving}>
          {isSaving ? (isAr ? 'جاري الحفظ…' : 'Saving…') : saveLabel}
        </Button>
        <Button onClick={onClose} disabled={isSaving}>
          {cancelLabel}
        </Button>
        {mode === 'edit' && onDelete && !isSystem && deleteLabel && (
          <Button
            variant="danger"
            className="ms-auto min-h-[44px]"
            onClick={onDelete}
            disabled={isDeleting || isSaving}
          >
            {deleteLabel}
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
