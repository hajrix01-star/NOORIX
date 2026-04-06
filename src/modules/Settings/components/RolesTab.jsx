/**
 * RolesTab — إدارة الأدوار والصلاحيات بمصفوفة ديناميكية.
 * ✅ المصفوفة تُجلب من Backend API — مصدر حقيقة واحد.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoles, getPermissionsSchema, createRole, updateRole, deleteRole } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import Toast from '../../../components/Toast';
import { Button, Input, Modal } from '../../../ui';

function Cb({ checked, indeterminate, onChange, disabled }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
      onChange={onChange}
      disabled={disabled}
      style={{
        width: 15, height: 15,
        accentColor: 'var(--noorix-accent)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    />
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, gap: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)', fontWeight: 500 }}>
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

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--noorix-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{
              background: 'var(--noorix-bg-page)',
              borderBottom: '2px solid var(--noorix-border)',
            }}>
              <th style={{ ...thStyle, textAlign: 'start', minWidth: 160 }}>
                {isAr ? 'القسم' : 'Module'}
              </th>
              <th style={{ ...thStyle, width: 44, textAlign: 'center',
                background: 'rgba(37,99,235,0.07)', borderInline: '1px solid var(--noorix-border)' }}>
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
                    <span style={{ marginInlineEnd: 5, fontSize: 14 }}>{mod.icon}</span>
                    {isAr ? mod.labelAr : mod.labelEn}
                  </td>

                  <td style={{
                    ...tdStyle, textAlign: 'center',
                    background: full
                      ? 'rgba(37,99,235,0.06)'
                      : partial ? 'rgba(245,158,11,0.06)' : undefined,
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
                        background: isChecked(perm) ? 'rgba(22,163,74,0.05)' : undefined,
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
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['roles'] });

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm({ name: '', nameAr: '', description: '', permissions: [] });
      setToast({ visible: true, message: t('roleAdded'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateRole(id, body),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(null);
      setToast({ visible: true, message: t('updateSuccess'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setToast({ visible: true, message: t('roleDeleted'), type: 'success' });
    },
    onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
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
      return <span style={{ color: 'var(--noorix-text-danger)', fontSize: 11 }}>{isAr ? 'بدون صلاحيات' : 'No permissions'}</span>;
    }
    if (perms.length >= allPermCount && allPermCount > 0) {
      return <span style={{ color: 'var(--noorix-accent)', fontSize: 11, fontWeight: 700 }}>{isAr ? 'كل الصلاحيات' : 'Full access'}</span>;
    }
    const activeModules = modules.filter((m) =>
      Object.values(m.permissions).some((p) => perms.includes(p))
    );
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {activeModules.slice(0, 5).map((m) => (
          <span key={m.key} style={{
            background: 'var(--noorix-accent-soft, rgba(59,130,246,0.1))',
            color: 'var(--noorix-accent)',
            padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            {m.icon} {isAr ? m.labelAr : m.labelEn}
          </span>
        ))}
        {activeModules.length > 5 && (
          <span style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>
            +{activeModules.length - 5}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
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
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--noorix-text-muted)' }}>
          {t('loading')}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {roles.map((role) => (
            <div key={role.id} className="noorix-surface-card" style={{
              padding: 16, borderRadius: 12,
              border: '1px solid var(--noorix-border)',
              cursor: 'pointer', transition: 'box-shadow 0.15s',
            }}
              onClick={() => openEdit(role)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{role.nameAr || role.name}</span>
                    {role.isSystem && (
                      <span style={{
                        background: 'var(--noorix-text-muted)', color: '#fff',
                        padding: '1px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                      }}>
                        {isAr ? 'نظام' : 'System'}
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <div style={{ fontSize: 12, color: 'var(--noorix-text-muted)', marginBottom: 6 }}>
                      {role.description}
                    </div>
                  )}
                  {renderPermissionBadges(role.permissions)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--noorix-accent)' }}>
                      {role._count?.users ?? 0}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>
                      {isAr ? 'مستخدم' : 'users'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {renderPermissionSummary(role.permissions)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--noorix-text-muted)' }}>
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
      <Modal
        open={showForm}
        onClose={() => !createMutation.isPending && setShowForm(false)}
        title={isAr ? 'إنشاء دور جديد' : 'Create New Role'}
        size="lg"
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
          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Input type="text" label={isAr ? 'اسم الدور (إنجليزي) *' : 'Role Name (EN) *'} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="warehouse_manager" required />
              <Input type="text" label={isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} placeholder="مدير المستودع" />
            </div>
            <Input type="text" label={isAr ? 'الوصف' : 'Description'} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
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

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('saving') : (isAr ? 'إنشاء الدور' : 'Create Role')}
            </Button>
            <Button type="button" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة تعديل دور */}
      <Modal
        open={!!editing}
        onClose={() => !updateMutation.isPending && setEditing(null)}
        title={editing ? (isAr ? `تعديل: ${editing.nameAr || editing.name}` : `Edit: ${editing.nameAr || editing.name}`) : ''}
        size="lg"
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
              <div style={{ marginBottom: 12 }}>
                <span style={{
                  background: 'var(--noorix-text-muted)', color: '#fff',
                  padding: '2px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                }}>
                  {isAr ? 'دور نظام' : 'System role'}
                </span>
              </div>
            )}
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Input type="text" label={isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'} value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} />
                <Input type="text" label={isAr ? 'الوصف' : 'Description'} value={editing.description} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
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

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
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
                  style={{ marginInlineStart: 'auto' }}
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
      </Modal>
    </div>
  );
}
