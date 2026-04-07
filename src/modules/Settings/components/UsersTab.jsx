/**
 * UsersTab — إدارة المستخدمين
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, archiveUser, restoreUser } from '../../../services/api';
import { getRoles } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import Toast from '../../../components/Toast';
import SmartTable from '../../../components/common/SmartTable';
import { Button, Badge, Input, AdaptiveSheet } from '../../../ui';

export default function UsersTab({ userRole, activeCompanies = [] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [form, setForm] = useState({ email: '', password: '', nameAr: '', nameEn: '', roleName: '', companyIds: [] });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await getUsers();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await getRoles();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { invalidate(); setShowForm(false); setToast({ visible: true, message: t('userAdded'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('addFailed'), type: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    onSuccess: () => { invalidate(); setEditing(null); setToast({ visible: true, message: t('updateSuccess'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveUser,
    onSuccess: () => { invalidate(); setEditing(null); setToast({ visible: true, message: t('userArchived'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreUser,
    onSuccess: () => { invalidate(); setEditing(null); setToast({ visible: true, message: t('userRestored'), type: 'success' }); },
    onError: (e) => setToast({ visible: true, message: e?.message || t('updateFailed'), type: 'error' }),
  });

  function openEdit(u) {
    setEditing({
      id: u.id,
      email: u.email,
      nameAr: u.nameAr || '',
      nameEn: u.nameEn || '',
      roleName: u.role?.name || '',
      companyIds: (u.userCompanies || []).map((uc) => uc.companyId),
      isActive: u.isActive !== false,
    });
  }

  const columns = [
    { key: 'email', label: t('email'), render: (v) => <span className="nx-font-600">{v || '—'}</span> },
    { key: 'nameAr', label: t('nameAr'), render: (v, row) => <span>{v || row.nameEn || '—'}</span> },
    { key: 'role', label: t('role'), render: (_, row) => <span>{row.role?.nameAr || row.role?.name || '—'}</span> },
    { key: 'companies', label: t('companies'), render: (_, row) => <span className="nx-cell-muted">{(row.userCompanies || []).map((uc) => uc.company?.nameAr).filter(Boolean).join(', ') || '—'}</span> },
    { key: 'status', label: t('status'), render: (_, row) => <Badge color={row.isActive ? 'green' : 'red'} size="sm">{row.isActive ? t('active') : t('archived')}</Badge> },
    { key: 'actions', label: t('actions'), render: (_, row) => <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button> },
  ];

  return (
    <div className="nx-screen">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div className="nx-flex-end">
        <Button variant="primary" onClick={() => { setForm({ email: '', password: '', nameAr: '', nameEn: '', roleName: roles[0]?.name || '', companyIds: [] }); setShowForm(true); }}>
          {t('addUser')}
        </Button>
      </div>

      {showForm && (
        <div className="noorix-surface-card nx-p-20" style={{ borderRadius: 14 }}>
          <h4 className="nx-text-md" style={{ margin: '0 0 16px' }}>{t('newUser')}</h4>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.email?.trim() || !form.password?.trim()) return; createMutation.mutate({ email: form.email.trim(), password: form.password, nameAr: form.nameAr?.trim(), nameEn: form.nameEn?.trim(), roleName: form.roleName || roles[0]?.name, companyIds: form.companyIds.length ? form.companyIds : activeCompanies.map((c) => c.id) }); }}>
            <div className="nx-grid nx-gap-12" style={{ marginBottom: 14, maxWidth: 400 }}>
              <Input type="email" label={`${t('email')} *`} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
              <Input type="password" label={`${t('password')} *`} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
              <Input type="text" label={t('nameAr')} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} />
              <Input type="select" label={t('role')} value={form.roleName} onChange={(e) => setForm((p) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="nx-text-sm nx-font-600 nx-mb-4" style={{ display: 'block' }}>{t('companies')}</label>
                <div className="nx-flex-col nx-gap-6">
                  {activeCompanies.map((c) => (
                    <label key={c.id} className="nx-checkbox">
                      <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={(e) => setForm((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                      {c.nameAr}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="nx-flex nx-gap-8">
              <Button type="submit" variant="primary" disabled={createMutation.isPending}>{createMutation.isPending ? t('saving') : t('save')}</Button>
              <Button type="button" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      <AdaptiveSheet
        open={!!editing}
        onClose={() => !updateMutation.isPending && setEditing(null)}
        title={editing ? t('editUser', editing.email) : ''}
        size="md"
        side="start"
        className="users-edit-drawer"
      >
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, body: { nameAr: editing.nameAr?.trim(), nameEn: editing.nameEn?.trim(), roleName: editing.roleName, companyIds: editing.companyIds } }); }}>
            <div className="nx-grid nx-gap-12" style={{ marginBottom: 14 }}>
              <Input type="email" label={t('email')} value={editing.email} disabled />
              <Input type="text" label={t('nameAr')} value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} />
              <Input type="select" label={t('role')} value={editing.roleName} onChange={(e) => setEditing((p) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="nx-text-sm nx-font-600 nx-mb-4" style={{ display: 'block' }}>{t('companies')}</label>
                {activeCompanies.map((c) => (
                  <label key={c.id} className="nx-checkbox nx-mb-4">
                    <input type="checkbox" checked={editing.companyIds.includes(c.id)} onChange={(e) => setEditing((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                    {c.nameAr}
                  </label>
                ))}
              </div>
            </div>
            <div className="nx-flex nx-gap-8 nx-flex-wrap">
              <Button type="submit" variant="primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('saving') : t('save')}</Button>
              <Button type="button" onClick={() => setEditing(null)}>{t('close')}</Button>
              {editing.isActive ? (
                <Button type="button" onClick={() => archiveMutation.mutate(editing.id)} disabled={archiveMutation.isPending}>أرشفة</Button>
              ) : (
                <Button type="button" onClick={() => restoreMutation.mutate(editing.id)} disabled={restoreMutation.isPending}>استعادة</Button>
              )}
            </div>
          </form>
        )}
      </AdaptiveSheet>

      <SmartTable
        columns={columns}
        data={users}
        total={users.length}
        page={1}
        pageSize={50}
        showRowNumbers
        rowNumberWidth="1%"
        isLoading={isLoading}
        title={t('usersTab')}
        emptyMessage={t('noUsers')}
        renderMobileCard={(row) => (
          <div className="nx-grid nx-gap-8">
            <div className="nx-flex-between nx-gap-8">
              <span className="nx-font-700 nx-text-md nx-text-primary">{row.nameAr || row.nameEn || row.email || '—'}</span>
              <Badge color={row.isActive ? 'green' : 'red'} size="sm">
                {row.isActive ? t('active') : t('archived')}
              </Badge>
            </div>
            <div className="nx-cell-muted nx-ltr" style={{ textAlign: 'right' }}>{row.email || '—'}</div>
            <div className="nx-flex-between nx-gap-8">
              <span className="nx-cell-muted">{row.role?.nameAr || row.role?.name || '—'}</span>
              <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
