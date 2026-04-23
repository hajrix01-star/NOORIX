/**
 * UsersTab — إدارة المستخدمين
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { getUsers, createUser, updateUser, archiveUser, restoreUser } from '../../../services/api';
import { getRoles } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Input, AdaptiveSheet, ScreenShell, SmartTable } from '../../../ui';

export default function UsersTab({ userRole, activeCompanies = [] }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ password: '', nameAr: '', roleName: '', preferredLang: 'ar', companyIds: [] });

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

  const createMutation = useApiMutation({
    mutationFn: createUser,
    invalidateQueries: [['users']],
    successToast: (res) => {
      const email = res?.data?.email;
      return email ? t('userAddedWithEmail', email) : t('userAdded');
    },
    errorToast: (e) => e?.message || t('addFailed'),
    onSuccess: () => { setShowForm(false); },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    invalidateQueries: [['users']],
    successToast: () => t('updateSuccess'),
    errorToast: (e) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const archiveMutation = useApiMutation({
    mutationFn: archiveUser,
    invalidateQueries: [['users']],
    successToast: () => t('userArchived'),
    errorToast: (e) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const restoreMutation = useApiMutation({
    mutationFn: restoreUser,
    invalidateQueries: [['users']],
    successToast: () => t('userRestored'),
    errorToast: (e) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  function openEdit(u) {
    setEditing({
      id: u.id,
      email: u.email,
      nameAr: u.nameAr || '',
      nameEn: u.nameEn || '',
      preferredLang: u.preferredLang || 'ar',
      roleName: u.role?.name || '',
      companyIds: (u.userCompanies || []).map((uc) => uc.companyId),
      isActive: u.isActive !== false,
    });
  }

  const columns = [
    { key: 'email', label: t('email'), render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'nameAr', label: t('nameAr'), render: (v, row) => <span>{v || row.nameEn || '—'}</span> },
    { key: 'preferredLang', label: t('preferredLang'), render: (v) => <Badge color={v === 'en' ? 'blue' : 'violet'} size="sm">{v === 'en' ? t('langEn') : t('langAr')}</Badge> },
    { key: 'role', label: t('role'), render: (_, row) => <span>{row.role?.nameAr || row.role?.name || '—'}</span> },
    { key: 'companies', label: t('companies'), render: (_, row) => <span className="nx-cell-muted">{(row.userCompanies || []).map((uc) => uc.company?.nameAr).filter(Boolean).join(', ') || '—'}</span> },
    { key: 'status', label: t('status'), render: (_, row) => <Badge color={row.isActive ? 'green' : 'red'} size="sm">{row.isActive ? t('active') : t('archived')}</Badge> },
    { key: 'actions', label: t('actions'), render: (_, row) => <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button> },
  ];

  return (
    <ScreenShell embedded>
      <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-end">
        <Button
          variant="primary"
          className="w-full min-h-[44px] min-[420px]:w-auto min-[420px]:min-h-0"
          onClick={() => { setForm({ password: '', nameAr: '', roleName: roles[0]?.name || '', preferredLang: 'ar', companyIds: [] }); setShowForm(true); }}
        >
          {t('addUser')}
        </Button>
      </div>

      {showForm && (
        <div className="noorix-surface-card p-5">
          <h4 className="text-[14px] m-0 mb-4">{t('newUser')}</h4>
          <form onSubmit={(e) => { e.preventDefault(); if (!form.nameAr?.trim() || !form.password?.trim()) return; createMutation.mutate({ password: form.password, nameAr: form.nameAr.trim(), preferredLang: form.preferredLang, roleName: form.roleName || roles[0]?.name, companyIds: form.companyIds.length ? form.companyIds : activeCompanies.map((c) => c.id) }); }}>
            <div className="grid w-full min-w-0 max-w-[400px] gap-3 mb-[14px]">
              <Input type="text" label={t('userCreateNameLabel')} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} required />
              <p className="text-[11px] text-noorix-muted m-0 -mt-2">{t('userEmailAutoHint')}</p>
              <Input type="password" label={`${t('password')} *`} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
              <Input type="select" label={t('preferredLang')} value={form.preferredLang} onChange={(e) => setForm((p) => ({ ...p, preferredLang: e.target.value }))}>
                <option value="ar">{t('langAr')}</option>
                <option value="en">{t('langEn')}</option>
              </Input>
              <Input type="select" label={t('role')} value={form.roleName} onChange={(e) => setForm((p) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="text-[12px] font-semibold mb-1 block">{t('companies')}</label>
                <div className="flex flex-col gap-1.5">
                  {activeCompanies.map((c) => (
                    <label key={c.id} className="nx-checkbox">
                      <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={(e) => setForm((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                      {c.nameAr}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 min-[400px]:flex-row min-[400px]:flex-wrap">
              <Button type="button" className="w-full min-h-[44px] min-[400px]:w-auto min-[400px]:min-h-0" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
              <Button type="submit" variant="primary" className="w-full min-h-[44px] min-[400px]:w-auto min-[400px]:min-h-0" disabled={createMutation.isPending}>{createMutation.isPending ? t('saving') : t('save')}</Button>
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
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ id: editing.id, body: { nameAr: editing.nameAr?.trim(), nameEn: editing.nameEn?.trim(), preferredLang: editing.preferredLang, roleName: editing.roleName, companyIds: editing.companyIds } }); }}>
            <div className="grid gap-3 mb-[14px]">
              <Input type="email" label={t('email')} value={editing.email} disabled />
              <Input type="text" label={t('nameAr')} value={editing.nameAr} onChange={(e) => setEditing((p) => ({ ...p, nameAr: e.target.value }))} />
              <Input type="select" label={t('preferredLang')} value={editing.preferredLang} onChange={(e) => setEditing((p) => ({ ...p, preferredLang: e.target.value }))}>
                <option value="ar">{t('langAr')}</option>
                <option value="en">{t('langEn')}</option>
              </Input>
              <Input type="select" label={t('role')} value={editing.roleName} onChange={(e) => setEditing((p) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="text-[12px] font-semibold mb-1 block">{t('companies')}</label>
                {activeCompanies.map((c) => (
                  <label key={c.id} className="nx-checkbox mb-1">
                    <input type="checkbox" checked={editing.companyIds.includes(c.id)} onChange={(e) => setEditing((p) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id) => id !== c.id) }))} />
                    {c.nameAr}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 min-[440px]:flex-row min-[440px]:flex-wrap">
              <Button type="submit" variant="primary" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('saving') : t('save')}</Button>
              <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => setEditing(null)}>{t('close')}</Button>
              {editing.isActive ? (
                <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => archiveMutation.mutate(editing.id)} disabled={archiveMutation.isPending}>أرشفة</Button>
              ) : (
                <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => restoreMutation.mutate(editing.id)} disabled={restoreMutation.isPending}>استعادة</Button>
              )}
            </div>
          </form>
        )}
      </AdaptiveSheet>

      <div className="min-w-0 w-full overflow-x-auto">
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
            <div className="grid gap-2 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-bold text-[14px] text-noorix-text min-w-0 break-words">{row.nameAr || row.nameEn || row.email || '—'}</span>
                <Badge color={row.isActive ? 'green' : 'red'} size="sm" className="shrink-0">
                  {row.isActive ? t('active') : t('archived')}
                </Badge>
              </div>
              <div className="nx-cell-muted nx-ltr text-right break-all">{row.email || '—'}</div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="nx-cell-muted min-w-0 break-words">{row.role?.nameAr || row.role?.name || '—'}</span>
                <Button size="sm" className="shrink-0" onClick={() => openEdit(row)}>{t('edit')}</Button>
              </div>
            </div>
          )}
        />
      </div>
    </ScreenShell>
  );
}
