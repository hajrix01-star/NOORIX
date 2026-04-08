/**
 * RolesTab — إدارة الأدوار والصلاحيات بمصفوفة ديناميكية.
 * ✅ المصفوفة تُجلب من Backend API — مصدر حقيقة واحد.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { getRoles, getPermissionsSchema, createRole, updateRole, deleteRole } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';

function Cb({ checked, indeterminate, onChange, disabled }) {
  return (
    <label className="nx-checkbox">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={onChange}
        disabled={disabled}
        className={disabled ? undefined : 'cursor-pointer'}
      />
    </label>
  );
}

function PermissionMatrix({ modules, levels, permissions, onChange, disabled, language }) {
  const isAr = language === 'ar';
  const levelKeys = Object.keys(levels);

  const isChecked = (perm) => permissions.includes(perm);

  const togglePerm = (perm) => {
    if (disabled) return;
    onChange(isChecked(perm)
      ? permissions.filter((p) => p !== perm)
      : [...permissions, perm]);
  };

  const toggleModule = (mod, checked) => {
    if (disabled) return;
    const modPerms = Object.values(mod.permissions);
    onChange(checked
      ? [...new Set([...permissions, ...modPerms])]
      : permissions.filter((p) => !modPerms.includes(p)));
  };

  const isModuleFull    = (mod) => Object.values(mod.permissions).every((p) => permissions.includes(p));
  const isModulePartial = (mod) => {
    const vals = Object.values(mod.permissions);
    const n = vals.filter((p) => permissions.includes(p)).length;
    return n > 0 && n < vals.length;
  };

  const allChecked = modules.every(isModuleFull);
  const totalPerms = modules.flatMap((m) => Object.values(m.permissions)).length;

  const toggleAll = () => {
    if (disabled) return;
    onChange(allChecked ? [] : [...new Set(modules.flatMap((m) => Object.values(m.permissions)))]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[12px] text-noorix-muted font-medium">
          {isAr
            ? `${permissions.length} / ${totalPerms} صلاحية`
            : `${permissions.length} / ${totalPerms} permissions`}
        </span>
        <Button
          size="sm"
          onClick={toggleAll}
          disabled={disabled}
        >
          {allChecked
            ? (isAr ? 'إلغاء الكل' : 'Deselect All')
            : (isAr ? 'تحديد الكل' : 'Select All')}
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-noorix-border">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr style={{
              background: 'var(--noorix-bg-page)',
              borderBottom: '2px solid var(--noorix-border)',
            }}>
              <th style={{ ...thStyle, textAlign: 'start', minWidth: 160 }}>
                {isAr ? 'القسم' : 'Module'}
              </th>
              <th style={{ ...thStyle, width: 44, textAlign: 'center',
                background: 'var(--noorix-blue-7)', borderInline: '1px solid var(--noorix-border)' }}>
                {isAr ? 'الكل' : 'All'}
              </th>
              {levelKeys.map((lvl) => (
                <th key={lvl} style={{ ...thStyle, textAlign: 'center', minWidth: 76 }}>
                  {isAr ? levels[lvl].ar : levels[lvl].en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((mod, idx) => {
              const full    = isModuleFull(mod);
              const partial = isModulePartial(mod);
              return (
                <tr key={mod.key} style={{
                  background: idx % 2 === 0
                    ? 'var(--noorix-bg-surface)'
                    : 'var(--noorix-bg-page)',
                  borderBottom: '1px solid var(--noorix-border)',
                  transition: 'background 0.1s',
                }}>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span className="me-[5px] text-[14px]">{mod.icon}</span>
                    {isAr ? mod.labelAr : mod.labelEn}
                  </td>

                  <td style={{
                    ...tdStyle, textAlign: 'center',
                    background: full
                      ? 'var(--noorix-blue-6)'
                      : partial ? 'var(--noorix-yellow-6)' : undefined,
                    borderInline: '1px solid var(--noorix-border)',
                  }}>
                    <Cb
                      checked={full}
                      indeterminate={partial}
                      onChange={(e) => toggleModule(mod, e.target.checked)}
                      disabled={disabled}
                    />
                  </td>

                  {levelKeys.map((lvl) => {
                    const perm = mod.permissions[lvl];
                    if (!perm) return (
                      <td key={lvl} style={{ ...tdStyle, textAlign: 'center', color: 'var(--noorix-border)', fontSize: 16 }}>·</td>
                    );
                    return (
                      <td key={lvl} style={{
                        ...tdStyle, textAlign: 'center',
                        background: isChecked(perm) ? 'var(--noorix-green-5)' : undefined,
                      }}>
                        <Cb
                          checked={isChecked(perm)}
                          onChange={() => togglePerm(perm)}
                          disabled={disabled}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '7px 10px',
  fontWeight: 700,
  fontSize: 12,
  color: 'var(--noorix-text-muted)',
  letterSpacing: '0.01em',
};
const tdStyle = {
  padding: '5px 10px',
  fontSize: 13,
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
};

export default function RolesTab({ userRole, language }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', nameAr: '', description: '', permissions: [] });

  // ── جلب المصفوفة من Backend (مصدر الحقيقة الوحيد) ──
  const { data: schema } = useQuery({
    queryKey: ['permissions-schema'],
    queryFn: async () => {
      const res = await getPermissionsSchema();
      return res?.success ? res.data : null;
    },
    staleTime: 30 * 60 * 1000, // 30 دقيقة — نادراً ما تتغير
  });

  const modules = schema?.modules || [];
  const levels  = schema?.levels  || {};

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await getRoles();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const createMutation = useApiMutation({
    mutationFn: createRole,
    invalidateQueries: [['roles']],
    successToast: () => t('roleAdded'),
    errorToast: (e) => e?.message || t('addFailed'),
    onSuccess: () => {
      setShowForm(false);
      setForm({ name: '', nameAr: '', description: '', permissions: [] });
    },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateRole(id, body),
    invalidateQueries: [['roles'], ['me']],
    successToast: () => t('updateSuccess'),
    errorToast: (e) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const deleteMutation = useApiMutation({
    mutationFn: deleteRole,
    invalidateQueries: [['roles']],
    successToast: () => t('roleDeleted'),
    errorToast: (e) => e?.message || t('deleteFailed'),
    onSuccess: () => { setEditing(null); },
  });

  function openEdit(r) {
    setEditing({
      id: r.id,
      name: r.name,
      nameAr: r.nameAr || '',
      description: r.description || '',
      permissions: Array.isArray(r.permissions) ? [...r.permissions] : [],
      isSystem: r.isSystem,
    });
  }

  const isAr = language === 'ar';
  const allPermCount = modules.flatMap((m) => Object.values(m.permissions)).length;

  function renderPermissionSummary(perms) {
    if (!Array.isArray(perms)) return '0';
    return `${perms.length} / ${allPermCount}`;
  }

  function renderPermissionBadges(perms) {
    if (!Array.isArray(perms) || perms.length === 0) {
      return <span className="text-[11px]" style={{ color: 'var(--noorix-text-danger)' }}>{isAr ? 'بدون صلاحيات' : 'No permissions'}</span>;
    }
    if (perms.length >= allPermCount && allPermCount > 0) {
      return <span className="text-[11px] font-bold" style={{ color: 'var(--noorix-accent)' }}>{isAr ? 'كل الصلاحيات' : 'Full access'}</span>;
    }
    const activeModules = modules.filter((m) =>
      Object.values(m.permissions).some((p) => perms.includes(p))
    );
    return (
      <div className="flex flex-wrap gap-1">
        {activeModules.slice(0, 5).map((m) => (
          <span key={m.key} className="rounded-xl font-semibold py-px px-2 text-[10px] whitespace-nowrap" style={{
            background: 'var(--noorix-accent-soft, var(--noorix-blue-10))',
            color: 'var(--noorix-accent)',
          }}>
            {m.icon} {isAr ? m.labelAr : m.labelEn}
          </span>
        ))}
        {activeModules.length > 5 && (
          <span className="text-noorix-muted text-[10px]">
            +{activeModules.length - 5}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2 flex flex-wrap">
        <div>
          <h3 className="m-0 text-[16px] font-bold">
            {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
          </h3>
          <p className="text-[12px] text-noorix-muted m-0 mt-1">
            {isAr ? 'أنشئ أدوار مخصصة وتحكم بالصلاحيات لكل صفحة وعملية' : 'Create custom roles and control permissions per page and operation'}
          </p>
        </div>
        <Button variant="primary" onClick={() => {
          setForm({ name: '', nameAr: '', description: '', permissions: [] });
          setShowForm(true);
        }}>
          {isAr ? '+ إنشاء دور جديد' : '+ Create New Role'}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-noorix-muted p-10">
          {t('loading')}
        </div>
      ) : (
        <div className="grid gap-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="noorix-surface-card cursor-pointer p-4 transition-[box-shadow] duration-150 hover:[box-shadow:var(--noorix-card-shadow-hover)]"
              onClick={() => openEdit(role)}
            >
              <div className="flex gap-3 flex-wrap justify-between items-start">
                <div className="flex-1 min-w-0 min-w-[200px]">
                  <div className="flex items-center gap-8 mb-1">
                    <span className="text-[15px] font-bold">{role.nameAr || role.name}</span>
                    {role.isSystem && (
                      <span className="rounded-lg font-bold py-px px-2 text-[9px] text-white" style={{
                        background: 'var(--noorix-text-muted)',
                      }}>
                        {isAr ? 'نظام' : 'System'}
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <div className="text-[12px] text-noorix-muted mb-1.5">
                      {role.description}
                    </div>
                  )}
                  {renderPermissionBadges(role.permissions)}
                </div>
                <div className="flex items-center gap-12 shrink-0">
                  <div className="text-center">
                    <div className="text-[18px] font-bold" style={{ color: 'var(--noorix-accent)' }}>
                      {role._count?.users ?? 0}
                    </div>
                    <div className="text-noorix-muted text-[11px]">
                      {isAr ? 'مستخدم' : 'users'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[18px] font-bold">
                      {renderPermissionSummary(role.permissions)}
                    </div>
                    <div className="text-noorix-muted text-[11px]">
                      {isAr ? 'صلاحية' : 'perms'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* نموذج إنشاء دور جديد */}
      <AdaptiveSheet
        open={showForm}
        onClose={() => !createMutation.isPending && setShowForm(false)}
        title={isAr ? 'إنشاء دور جديد' : 'Create New Role'}
        size="lg"
        side="start"
        className="roles-create-drawer"
      >
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!form.name?.trim()) return;
          createMutation.mutate({
            name: form.name.trim().toLowerCase().replace(/\s+/g, '_'),
            nameAr: form.nameAr?.trim(),
            description: form.description?.trim(),
            permissions: form.permissions,
          });
        }}>
          <div className="grid gap-3 mb-4">
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              <Input type="text" label={isAr ? 'اسم الدور (إنجليزي) *' : 'Role Name (EN) *'} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="warehouse_manager" required />
              <Input type="text" label={isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} placeholder="مدير المستودع" />
            </div>
            <Input type="text" label={isAr ? 'الوصف' : 'Description'} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <h4 className="text-[14px] font-bold m-0 mb-3">
            {isAr ? 'الصلاحيات' : 'Permissions'}
          </h4>
          <PermissionMatrix
            modules={modules}
            levels={levels}
            permissions={form.permissions}
            onChange={(perms) => setForm((p) => ({ ...p, permissions: perms }))}
            disabled={false}
            language={language}
          />

          <div className="flex gap-2 mt-4">
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('saving') : (isAr ? 'إنشاء الدور' : 'Create Role')}
            </Button>
            <Button type="button" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </AdaptiveSheet>

      {/* نافذة تعديل دور */}
      <AdaptiveSheet
        open={!!editing}
        onClose={() => !updateMutation.isPending && setEditing(null)}
        title={editing ? (isAr ? `تعديل: ${editing.nameAr || editing.name}` : `Edit: ${editing.nameAr || editing.name}`) : ''}
        size="lg"
        side="start"
        className="roles-edit-drawer"
      >
        {editing && (
          <form onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({
              id: editing.id,
              body: {
                nameAr: editing.nameAr?.trim(),
                description: editing.description?.trim(),
                permissions: editing.permissions,
              },
            });
          }}>
            {editing.isSystem && (
              <div className="mb-3">
                <span className="rounded-lg font-bold py-px px-[10px] text-[10px] text-white" style={{
                  background: 'var(--noorix-text-muted)',
                }}>
                  {isAr ? 'دور نظام' : 'System role'}
                </span>
              </div>
            )}
            <div className="grid gap-3 mb-4">
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                <Input type="text" label={isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'} value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} />
                <Input type="text" label={isAr ? 'الوصف' : 'Description'} value={editing.description} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <h4 className="text-[14px] font-bold m-0 mb-3">
              {isAr ? 'مصفوفة الصلاحيات' : 'Permissions Matrix'}
            </h4>
            <PermissionMatrix
              modules={modules}
              levels={levels}
              permissions={editing.permissions}
              onChange={(perms) => setEditing((p) => ({ ...p, permissions: perms }))}
              disabled={false}
              language={language}
            />

            <div className="flex gap-2 mt-4 flex flex-wrap">
              <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('saving') : t('save')}
              </Button>
              <Button type="button" onClick={() => setEditing(null)}>
                {t('close')}
              </Button>
              {!editing.isSystem && (
                <Button
                  type="button"
                  variant="danger"
                  className="ms-auto"
                  onClick={() => {
                    const msg = isAr
                      ? `هل تريد حذف الدور "${editing.nameAr || editing.name}"؟`
                      : `Delete role "${editing.nameAr || editing.name}"?`;
                    if (confirm(msg)) deleteMutation.mutate(editing.id);
                  }}
                  disabled={deleteMutation.isPending}>
                  {isAr ? 'حذف الدور' : 'Delete Role'}
                </Button>
              )}
            </div>
          </form>
        )}
      </AdaptiveSheet>
    </div>
  );
}
