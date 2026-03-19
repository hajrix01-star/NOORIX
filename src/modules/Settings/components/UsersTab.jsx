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

const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)', background: 'var(--noorix-bg-surface)', fontSize: 13 };

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
    { key: 'email', label: t('email'), render: (v) => <span style={{ fontWeight: 600 }}>{v || '—'}</span> },
    { key: 'nameAr', label: t('nameAr'), render: (v, row) => <span>{v || row.nameEn || '—'}</span> },
    { key: 'role', label: t('role'), render: (_, row) => <span>{row.role?.nameAr || row.role?.name || '—'}</span> },
    { key: 'companies', label: t('companies'), render: (_, row) => <span style={{ fontSize: 12 }}>{(row.userCompanies || []).map((uc) => uc.company?.nameAr).filter(Boolean).join(', ') || '—'}</span> },
    { key: 'status', label: t('status'), render: (_, row) => <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: row.isActive ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: row.isActive ? '#16a34a' : '#ef4444' }}>{row.isActive ? t('active') : t('archived')}</span> },
    { key: 'actions', label: t('actions'), render: (_, row) => <button type="button" className="noorix-btn-nav" style={{ fontSize: 12 }} onClick={() => openEdit(row)}>{t('edit')}</button> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onDismiss={() => setToast((p) => ({ ...p, visible: false }))} />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="noorix-btn-nav noorix-btn-primary" onClick={() => { setForm({ email: '', password: '', nameAr: '', nameEn: '', roleName: roles[0]?.name || '', companyIds: [] }); setShowForm(true); }}>
          {t('addUser')}
        </button>
      </div>

      {showForm && (
        <div className="noorix-surface-card" style={{ padding: 20, borderRadius: 14 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{t('newUser')}</h4>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.email?.trim() || !form.password?.trim()) return; createMutation.mutate({ email: form.email.trim(), password: form.password, nameAr: form.nameAr?.trim(), nameEn: form.nameEn?.trim(), roleName: form.roleName || roles[0]?.name, companyIds: form.companyIds.length ? form.companyIds : activeCompanies.map((c) => c.id) }); }}>
            <div style={{ display: 'grid', gap: 12, marginBottom: 14, maxWidth: 400 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('email')} *</label><input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} required /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('password')} *</label><input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} style={inputStyle} required /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')}</label><input type="text" value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} style={inputStyle} /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('role')}</label>
                <select value={form.roleName} onChange={(e) => setForm((p) => ({ ...p, roleName: e.target.value }))} style={inputStyle}>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
                </select>
              </div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('companies')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeCompanies.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={(e) => setForm((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                      {c.nameAr}
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
          <div className="noorix-surface-card" style={{ padding: 20, maxWidth: 420, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 16px', fontSize: 14 }}>{t('editUser', editing.email)}</h4>
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, body: { nameAr: editing.nameAr?.trim(), nameEn: editing.nameEn?.trim(), roleName: editing.roleName, companyIds: editing.companyIds } }); }}>
              <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('email')}</label><input type="email" value={editing.email} disabled style={{ ...inputStyle, opacity: 0.7 }} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('nameAr')}</label><input type="text" value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} style={inputStyle} /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('role')}</label>
                  <select value={editing.roleName} onChange={(e) => setEditing((p) => ({ ...p, roleName: e.target.value }))} style={inputStyle}>
                    {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
                  </select>
                </div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t('companies')}</label>
                  {activeCompanies.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
                      <input type="checkbox" checked={editing.companyIds.includes(c.id)} onChange={(e) => setEditing((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                      {c.nameAr}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" className="noorix-btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('saving') : t('save')}</button>
                <button type="button" className="noorix-btn-nav" onClick={() => setEditing(null)}>{t('close')}</button>
                {editing.isActive ? (
                  <button type="button" className="noorix-btn-nav" onClick={() => archiveMutation.mutate(editing.id)} disabled={archiveMutation.isPending}>أرشفة</button>
                ) : (
                  <button type="button" className="noorix-btn-nav" onClick={() => restoreMutation.mutate(editing.id)} disabled={restoreMutation.isPending}>استعادة</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <SmartTable columns={columns} data={users} total={users.length} page={1} pageSize={50} showRowNumbers rowNumberWidth="1%" isLoading={isLoading} title={t('usersTab')} emptyMessage={t('noUsers')} />
    </div>
  );
}
