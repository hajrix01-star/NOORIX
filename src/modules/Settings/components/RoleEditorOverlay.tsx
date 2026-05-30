/**
 * RoleEditorOverlay — محرّر دور بشاشة كاملة + accordion (صفحة واحدة، بدون sidebar).
 */
import React, { useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '../../../ui';
import { normalizeModuleViewAccess } from '../../../constants/permissions';
import RolePermissionsAccordion from './RolePermissionsAccordion';
import { ROLE_PRESETS } from './rolePermissionPresets';
import { getModulePermValues, type PermissionModuleShape } from './rolePermissionGroups';

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
  const totalPerms = useMemo(
    () => modules.flatMap((m) => getModulePermValues(m)).length,
    [modules],
  );

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

  if (!open || !modules.length) return null;

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

  return createPortal(
    <div
      className="role-editor-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shrink-0 border-b border-noorix-border bg-noorix-surface px-4 pt-3 pb-0 lg:px-6">
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
          <span className="text-[12px] text-noorix-muted shrink-0">
            {form.permissions.length} / {totalPerms}
          </span>
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

        <div className="rounded-lg border border-noorix-border bg-[var(--noorix-blue-7)] p-3 mb-0">
          <p className="m-0 mb-2 text-[13px] font-bold text-noorix-text">
            {isAr ? 'ابدأ من قالب جاهز (أسرع)' : 'Start from a preset (fastest)'}
          </p>
          <div className="flex flex-wrap gap-2">
            {ROLE_PRESETS.map((p, idx) => (
              <Button
                key={p.id}
                size="sm"
                variant={idx === 0 ? 'primary' : 'ghost'}
                disabled={isSaving}
                onClick={() => applyPreset(p.id)}
              >
                {isAr ? p.labelAr : p.labelEn}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-0 lg:px-4 lg:pb-4">
        <RolePermissionsAccordion
          open={open}
          modules={modules}
          levels={levels}
          permissions={form.permissions}
          onChange={(perms) => onFormChange({ permissions: perms })}
          disabled={isSaving}
          isAr={isAr}
        />
      </main>

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
