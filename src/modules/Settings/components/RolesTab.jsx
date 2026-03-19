/**
 * RolesTab — إدارة الأدوار والصلاحيات
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRoles, createRole, updateRole, deleteRole } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import Toast from '../../../components/Toast';
import SmartTable from '../../../components/common/SmartTable';

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 };

export default function RolesTab({ userRole }) {
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
    onSuccess: () => { invalidate(); setShowForm(false); setToast({ visible: true, message: t('roleAdded'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateRole(id, body),
    onSuccess: () => { invalidate(); setEditing(null); setToast({ visible: true, message: t('updateSuccess'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => { invalidate(); setEditing(null); setToast({ visible: true, message: t('roleDeleted'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('deleteFailed'), type: 'error' }),
  });

  const PERMISSION_OPTIONS = [
    'INVOICES_READ', 'INVOICES_WRITE', 'SUPPLIERS_READ', 'SUPPLIERS_WRITE',
    'MANAGE_USERS', 'SALES_READ', 'SALES_WRITE', 'REPORTS_READ', 'HR_READ', 'HR_WRITE',
  ];

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

  const columns = [
    { key: 'name', label: t('role'), render: (v, row) => <span style={{ fontWeight: 700 }}>{row.nameAr || v || '—'}</span> },
    { key: 'description', label: t('description'), render: (v) => <span style={{ fontSize: 12, color: 'var(--noorix-text-muted)' }}>{v || '—'}</span> },
    { key: 'permissions', label: t('permissions'), render: (v) => <span style={{ fontSize: 11 }}>{(Array.isArray(v) ? v : []).length} صلاحية</span> },
    { key: 'users', label: t('usersCount'), render: (_, row) => <span style={{ fontSize: 12 }}>{row._count?.users ?? 0}</span> },
    { key: 'actions', label: t('actions'), render: (_, row) => <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => openEdit(row)} disabled={row.isSystem}>{t('edit')}</button> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => { setForm({ name: '', nameAr: '', description: '', permissions: [] }); setShowForm(true); }}>
          {t('addCustomRole')}
        </button>
      </div>

      {showForm && (
        <div className="noorix-surface-card" style={{ padding: 20, borderRadius: 14 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{t('addNewRole')}</h4>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.name?.trim()) return; createMutation.mutate({ name: form.name.trim(), nameAr: form.nameAr?.trim(), description: form.description?.trim(), permissions: form.permissions }); }}>
            <div style={{ display: 'grid', gap: 12, marginBottom: 14, maxWidth: 400 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('roleNameEn')} *</label><input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="accountant" style={inputStyle} required /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')}</label><input type="text" value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} style={inputStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('description')}</label><input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={inputStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('permissions')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.permissions.includes(perm)} onChange={(e) => setForm((p) => ({ ...p, permissions: e.target.checked ? [...p.permissions, perm] : p.permissions.filter((x) => x !== perm) }))} />
                      {perm}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="noorix-btn-primary" disabled={createMutation.isPending}>{createMutation.isPending ? t('saving') : t('save')}</button>
              <button type="button" className="noorix-btn-nav" onClick={() => setShowForm(false)}>{t('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {editing && (
        <div role="dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => !updateMutation.isPending && setEditing(null)}>
          <div className="noorix-surface-card" style={{ padding: 20, maxWidth: 420, width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{t('editRole', editing.nameAr || editing.name)}</h4>
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, body: { nameAr: editing.nameAr?.trim(), description: editing.description?.trim(), permissions: editing.permissions } }); }}>
              <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')}</label><input type="text" value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} style={inputStyle} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('description')}</label><input type="text" value={editing.description} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} style={inputStyle} /></div>
                {!editing.isSystem && (
                  <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('permissions')}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'auto' }}>
                      {PERMISSION_OPTIONS.map((perm) => (
                        <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={editing.permissions.includes(perm)} onChange={(e) => setEditing((p) => ({ ...p, permissions: e.target.checked ? [...p.permissions, perm] : p.permissions.filter((x) => x !== perm) }))} />
                          {perm}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="noorix-btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('saving') : t('save')}</button>
                <button type="button" className="noorix-btn-nav" onClick={() => setEditing(null)}>{t('close')}</button>
                {!editing.isSystem && (
                  <button type="button" className="noorix-btn-nav" style={{ color: 'var(--noorix-text-danger)' }} onClick={() => confirm(t('deleteRoleConfirm', editing.nameAr || editing.name)) && deleteMutation.mutate(editing.id)} disabled={deleteMutation.isPending}>حذف</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <SmartTable columns={columns} data={roles} total={roles.length} page={1} pageSize={50} showRowNumbers rowNumberWidth="1%" isLoading={isLoading} title={t('rolesTab')} emptyMessage={t('noRoles')} />
    </div>
  );
}
