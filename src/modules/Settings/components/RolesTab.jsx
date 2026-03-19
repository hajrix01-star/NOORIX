/**
 * RolesTab — إدارة الأدوار والصلاحيات بمصفوفة مهنية
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoles, createRole, updateRole, deleteRole } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { PERMISSION_MODULES, PERMISSION_LEVELS } from '../../../constants/permissions';
import Toast from '../../../components/Toast';

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)', fontSize: 13,
};

const levelKeys = Object.keys(PERMISSION_LEVELS);

function PermissionMatrix({ permissions, onChange, disabled, language }) {
  const isAr = language === 'ar';

  function isChecked(perm) {
    return permissions.includes(perm);
  }

  function togglePerm(perm) {
    if (disabled) return;
    onChange(
      isChecked(perm)
        ? permissions.filter((p) => p !== perm)
        : [...permissions, perm]
    );
  }

  function toggleModule(mod, checked) {
    if (disabled) return;
    const modPerms = Object.values(mod.permissions);
    if (checked) {
      const merged = [...new Set([...permissions, ...modPerms])];
      onChange(merged);
    } else {
      onChange(permissions.filter((p) => !modPerms.includes(p)));
    }
  }

  function isModuleFullyChecked(mod) {
    return Object.values(mod.permissions).every((p) => permissions.includes(p));
  }
  function isModulePartiallyChecked(mod) {
    const vals = Object.values(mod.permissions);
    const count = vals.filter((p) => permissions.includes(p)).length;
    return count > 0 && count < vals.length;
  }

  function selectAll() {
    if (disabled) return;
    const all = PERMISSION_MODULES.flatMap((m) => Object.values(m.permissions));
    onChange([...new Set(all)]);
  }
  function deselectAll() {
    if (disabled) return;
    onChange([]);
  }

  const allChecked = PERMISSION_MODULES.every((m) => isModuleFullyChecked(m));

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10 }}>
        <button type="button" className="noorix-btn-nav" style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={allChecked ? deselectAll : selectAll} disabled={disabled}>
          {allChecked
            ? (isAr ? 'إلغاء تحديد الكل' : 'Deselect All')
            : (isAr ? 'تحديد الكل' : 'Select All')}
        </button>
      </div>

      <table style={{
        width: '100%', borderCollapse: 'collapse', fontSize: 13,
        border: '1px solid var(--noorix-border)', borderRadius: 10,
        overflow: 'hidden',
      }}>
        <thead>
          <tr style={{ background: 'var(--noorix-bg-header, var(--noorix-bg-surface))' }}>
            <th style={{ ...thStyle, textAlign: 'start', minWidth: 180 }}>
              {isAr ? 'القسم' : 'Module'}
            </th>
            <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>
              {isAr ? 'الكل' : 'All'}
            </th>
            {levelKeys.map((lvl) => (
              <th key={lvl} style={{ ...thStyle, textAlign: 'center', minWidth: 90 }}>
                {isAr ? PERMISSION_LEVELS[lvl].ar : PERMISSION_LEVELS[lvl].en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_MODULES.map((mod, idx) => {
            const fullChecked = isModuleFullyChecked(mod);
            const partial = isModulePartiallyChecked(mod);
            return (
              <tr key={mod.key} style={{
                background: idx % 2 === 0 ? 'var(--noorix-bg-surface)' : 'var(--noorix-bg-alt, var(--noorix-bg))',
                borderBottom: '1px solid var(--noorix-border)',
              }}>
                <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ marginInlineEnd: 6 }}>{mod.icon}</span>
                  {isAr ? mod.labelAr : mod.labelEn}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={fullChecked}
                    ref={(el) => { if (el) el.indeterminate = partial; }}
                    onChange={(e) => toggleModule(mod, e.target.checked)}
                    disabled={disabled}
                    style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                  />
                </td>
                {levelKeys.map((lvl) => {
                  const perm = mod.permissions[lvl];
                  if (!perm) {
                    return <td key={lvl} style={{ ...tdStyle, textAlign: 'center', color: 'var(--noorix-text-muted)' }}>—</td>;
                  }
                  return (
                    <td key={lvl} style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isChecked(perm)}
                        onChange={() => togglePerm(perm)}
                        disabled={disabled}
                        style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: 16, height: 16 }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--noorix-text-muted)' }}>
        {isAr
          ? `${permissions.length} صلاحية محددة من أصل ${PERMISSION_MODULES.flatMap((m) => Object.values(m.permissions)).length}`
          : `${permissions.length} of ${PERMISSION_MODULES.flatMap((m) => Object.values(m.permissions)).length} permissions selected`}
      </div>
    </div>
  );
}

const thStyle = { padding: '10px 12px', fontWeight: 700, fontSize: 12, borderBottom: '2px solid var(--noorix-border)' };
const tdStyle = { padding: '8px 12px', fontSize: 13 };

export default function RolesTab({ userRole, language }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [form, setForm] = useState({ name: '', nameAr: '', description: '', permissions: [] });

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
  const allPermCount = PERMISSION_MODULES.flatMap((m) => Object.values(m.permissions)).length;

  function renderPermissionSummary(perms) {
    if (!Array.isArray(perms)) return '0';
    return `${perms.length} / ${allPermCount}`;
  }

  function renderPermissionBadges(perms) {
    if (!Array.isArray(perms) || perms.length === 0) {
      return <span style={{ color: 'var(--noorix-text-danger)', fontSize: 11 }}>{isAr ? 'بدون صلاحيات' : 'No permissions'}</span>;
    }
    if (perms.length >= allPermCount) {
      return <span style={{ color: 'var(--noorix-accent)', fontSize: 11, fontWeight: 700 }}>{isAr ? 'كل الصلاحيات' : 'Full access'}</span>;
    }
    const activeModules = PERMISSION_MODULES.filter((m) =>
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

      {/* ── رأس القسم ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--noorix-text-muted)' }}>
            {isAr ? 'أنشئ أدوار مخصصة وتحكم بالصلاحيات لكل صفحة وعملية' : 'Create custom roles and control permissions per page and operation'}
          </p>
        </div>
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => {
          setForm({ name: '', nameAr: '', description: '', permissions: [] });
          setShowForm(true);
        }}>
          {isAr ? '+ إنشاء دور جديد' : '+ Create New Role'}
        </button>
      </div>

      {/* ── قائمة الأدوار ── */}
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

      {/* ── نموذج إنشاء دور جديد ── */}
      {showForm && (
        <div role="dialog" style={overlayStyle} onClick={() => !createMutation.isPending && setShowForm(false)}>
          <div className="noorix-surface-card" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              {isAr ? 'إنشاء دور جديد' : 'Create New Role'}
            </h3>
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
                  <div>
                    <label style={labelStyle}>{isAr ? 'اسم الدور (إنجليزي) *' : 'Role Name (EN) *'}</label>
                    <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="warehouse_manager" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>{isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'}</label>
                    <input type="text" value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                      placeholder="مدير المستودع" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>{isAr ? 'الوصف' : 'Description'}</label>
                  <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
                {isAr ? 'الصلاحيات' : 'Permissions'}
              </h4>
              <PermissionMatrix
                permissions={form.permissions}
                onChange={(perms) => setForm((p) => ({ ...p, permissions: perms }))}
                disabled={false}
                language={language}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit" className="noorix-btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t('saving') : (isAr ? 'إنشاء الدور' : 'Create Role')}
                </button>
                <button type="button" className="noorix-btn-nav" onClick={() => setShowForm(false)}>
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── نموذج تعديل دور ── */}
      {editing && (
        <div role="dialog" style={overlayStyle} onClick={() => !updateMutation.isPending && setEditing(null)}>
          <div className="noorix-surface-card" style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {isAr ? `تعديل: ${editing.nameAr || editing.name}` : `Edit: ${editing.nameAr || editing.name}`}
              </h3>
              {editing.isSystem && (
                <span style={{
                  background: 'var(--noorix-text-muted)', color: '#fff',
                  padding: '2px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                }}>
                  {isAr ? 'دور نظام — يمكن عرض الصلاحيات فقط' : 'System role — view only'}
                </span>
              )}
            </div>
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
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>{isAr ? 'اسم الدور (عربي)' : 'Role Name (AR)'}</label>
                    <input type="text" value={editing.nameAr}
                      onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))}
                      style={inputStyle} disabled={editing.isSystem} />
                  </div>
                  <div>
                    <label style={labelStyle}>{isAr ? 'الوصف' : 'Description'}</label>
                    <input type="text" value={editing.description}
                      onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
                      style={inputStyle} disabled={editing.isSystem} />
                  </div>
                </div>
              </div>

              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
                {isAr ? 'مصفوفة الصلاحيات' : 'Permissions Matrix'}
              </h4>
              <PermissionMatrix
                permissions={editing.permissions}
                onChange={(perms) => setEditing((p) => ({ ...p, permissions: perms }))}
                disabled={editing.isSystem}
                language={language}
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {!editing.isSystem && (
                  <button type="submit" className="noorix-btn-primary" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? t('saving') : t('save')}
                  </button>
                )}
                <button type="button" className="noorix-btn-nav" onClick={() => setEditing(null)}>
                  {t('close')}
                </button>
                {!editing.isSystem && (
                  <button type="button" className="noorix-btn-nav" style={{ color: 'var(--noorix-text-danger)', marginInlineStart: 'auto' }}
                    onClick={() => {
                      const msg = isAr
                        ? `هل تريد حذف الدور "${editing.nameAr || editing.name}"؟`
                        : `Delete role "${editing.nameAr || editing.name}"?`;
                      if (confirm(msg)) deleteMutation.mutate(editing.id);
                    }}
                    disabled={deleteMutation.isPending}>
                    {isAr ? 'حذف الدور' : 'Delete Role'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  padding: 16,
};

const modalStyle = {
  padding: 24, maxWidth: 800, width: '100%',
  maxHeight: '92vh', overflow: 'auto', borderRadius: 16,
};

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4,
};
