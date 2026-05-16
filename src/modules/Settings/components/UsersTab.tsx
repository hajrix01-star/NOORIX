/**
 * UsersTab — إدارة المستخدمين
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { getUsers, createUser, updateUser, archiveUser, restoreUser } from '../../../services/api';
import { getRoles } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, Input, AdaptiveSheet, ScreenShell, SmartTable } from '../../../ui';
import { settingsKeys } from '../../../services/queryKeys';

/** الجزء المحلي من البريد الداخلي → اسم الدخول المعروض للمستخدم. */
function toLoginName(email: string): string {
  if (!email) return '—';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

export default function UsersTab({ userRole, activeCompanies = [] }: any) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  /** Archived users (isActive === false) are hidden until this is toggled on */
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ password: string; nameAr: string; roleName: string; preferredLang: string; companyIds: string[] }>({ password: '', nameAr: '', roleName: '', preferredLang: 'ar', companyIds: [] });
  const [loginNameEdit, setLoginNameEdit] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: settingsKeys.users(),
    queryFn: async () => {
      const res = await getUsers();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: settingsKeys.roles(),
    queryFn: async () => {
      const res = await getRoles();
      return res?.success ? (res.data ?? []) : [];
    },
  });

  const createMutation = useApiMutation({
    mutationFn: createUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: (res: any) => {
      const loginName = toLoginName(res?.data?.email);
      return loginName && loginName !== '—' ? t('userAddedWithEmail', loginName) : t('userAdded');
    },
    errorToast: (e: any) => e?.message || t('addFailed'),
    onSuccess: () => { setShowForm(false); },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: any) => updateUser(id, body),
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('updateSuccess'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const archiveMutation = useApiMutation({
    mutationFn: archiveUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('userArchived'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const restoreMutation = useApiMutation({
    mutationFn: restoreUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('userRestored'),
    errorToast: (e: any) => e?.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const visibleUsers = useMemo(
    () => (showArchived ? users : users.filter((u: any) => u.isActive !== false)),
    [users, showArchived],
  );

  function openEdit(u: any) {
    const ln = toLoginName(u.email);
    setLoginNameEdit(ln);
    setEditing({
      id: u.id,
      email: u.email,
      nameAr: u.nameAr || '',
      nameEn: u.nameEn || '',
      preferredLang: u.preferredLang || 'ar',
      roleName: u.role?.name || '',
      companyIds: (u.userCompanies || []).map((uc: any) => uc.companyId),
      isActive: u.isActive !== false,
    });
  }

  /** هل اسم الدخول مُولَّد تلقائياً (user-xxxxxxxx)؟ */
  function isAutoGenLoginName(ln: string): boolean {
    return /^user-[0-9a-f]{8}$/.test(ln);
  }

  const columns = [
    { key: 'email', label: t('loginName'), render: (v: any) => <span className="font-semibold ltr">{toLoginName(v)}</span> },
    { key: 'nameAr', label: t('nameAr'), render: (v: any, row: any) => <span>{v || row.nameEn || '—'}</span> },
    { key: 'preferredLang', label: t('preferredLang'), render: (v: any) => <Badge color={v === 'en' ? 'blue' : 'violet'} size="sm">{v === 'en' ? t('langEn') : t('langAr')}</Badge> },
    { key: 'role', label: t('role'), render: (_: any, row: any) => <span>{row.role?.nameAr || row.role?.name || '—'}</span> },
    { key: 'companies', label: t('companies'), render: (_: any, row: any) => <span className="nx-cell-muted">{(row.userCompanies || []).map((uc: any) => uc.company?.nameAr).filter(Boolean).join(', ') || '—'}</span> },
    { key: 'status', label: t('status'), render: (_: any, row: any) => <Badge color={row.isActive ? 'green' : 'red'} size="sm">{row.isActive ? t('active') : t('archived')}</Badge> },
    { key: 'actions', label: t('actions'), render: (_: any, row: any) => <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button> },
  ];

  return (
    <ScreenShell embedded>
      <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-end">
        <Button
          size="sm"
          variant={showArchived ? 'primary' : 'ghost'}
          className="w-full min-h-[44px] min-[420px]:w-auto min-[420px]:min-h-0"
          onClick={() => setShowArchived((v) => !v)}
          aria-pressed={showArchived}
        >
          {showArchived ? t('hideArchivedUsers') : t('showArchivedUsers')}
        </Button>
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
          <form onSubmit={(e: any) => { e.preventDefault(); if (!form.nameAr?.trim() || !form.password?.trim()) return; createMutation.mutate({ password: form.password, nameAr: form.nameAr.trim(), preferredLang: form.preferredLang, roleName: form.roleName || roles[0]?.name, companyIds: form.companyIds.length ? form.companyIds : activeCompanies.map((c: any) => c.id) }); }}>
            <div className="grid w-full min-w-0 max-w-[400px] gap-3 mb-[14px]">
              <Input type="text" label={t('userCreateNameLabel')} value={form.nameAr} onChange={(e: any) => setForm((p: any) => ({ ...p, nameAr: e.target.value }))} required />
              <p className="text-[11px] text-noorix-muted m-0 -mt-2">{t('userEmailAutoHint')}</p>
              <Input type="password" label={`${t('password')} *`} value={form.password} onChange={(e: any) => setForm((p: any) => ({ ...p, password: e.target.value }))} required />
              <Input type="select" label={t('preferredLang')} value={form.preferredLang} onChange={(e: any) => setForm((p: any) => ({ ...p, preferredLang: e.target.value }))}>
                <option value="ar">{t('langAr')}</option>
                <option value="en">{t('langEn')}</option>
              </Input>
              <Input type="select" label={t('role')} value={form.roleName} onChange={(e: any) => setForm((p: any) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r: any) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="text-[12px] font-semibold mb-1 block">{t('companies')}</label>
                <div className="flex flex-col gap-1.5">
                  {activeCompanies.map((c: any) => (
                    <label key={c.id} className="nx-checkbox">
                      <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={(e: any) => setForm((p: any) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id: any) => id !== c.id) }))} />
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
        title={editing ? t('editUser', toLoginName(editing.email)) : ''}
        size="md"
        side="start"
        className="users-edit-drawer"
      >
        {editing && (
          <form onSubmit={(e: any) => {
            e.preventDefault();
            const ln = loginNameEdit.trim().toLowerCase();
            const body: any = { nameAr: editing.nameAr?.trim(), nameEn: editing.nameEn?.trim(), preferredLang: editing.preferredLang, roleName: editing.roleName, companyIds: editing.companyIds };
            if (ln && ln !== toLoginName(editing.email)) body.loginName = ln;
            updateMutation.mutate({ id: editing.id, body });
          }}>
            <div className="grid gap-3 mb-[14px]">
              {isAutoGenLoginName(toLoginName(editing.email)) && (
                <div className="text-[12px] text-noorix-amber bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                  {t('loginNameAutoWarning')}
                </div>
              )}
              <div>
                <Input
                  type="text"
                  label={t('loginNameEdit')}
                  value={loginNameEdit}
                  onChange={(e: any) => setLoginNameEdit(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  dir="ltr"
                  placeholder={t('loginNamePlaceholder')}
                />
                <p className="text-[11px] text-noorix-muted mt-1 mb-0">{t('loginNameValidation')}</p>
              </div>
              <Input type="text" label={t('nameAr')} value={editing.nameAr} onChange={(e: any) => setEditing((p: any) => ({ ...p, nameAr: e.target.value }))} />
              <Input type="select" label={t('preferredLang')} value={editing.preferredLang} onChange={(e: any) => setEditing((p: any) => ({ ...p, preferredLang: e.target.value }))}>
                <option value="ar">{t('langAr')}</option>
                <option value="en">{t('langEn')}</option>
              </Input>
              <Input type="select" label={t('role')} value={editing.roleName} onChange={(e: any) => setEditing((p: any) => ({ ...p, roleName: e.target.value }))}>
                {roles.map((r: any) => <option key={r.id} value={r.name}>{r.nameAr || r.name}</option>)}
              </Input>
              <div><label className="text-[12px] font-semibold mb-1 block">{t('companies')}</label>
                {activeCompanies.map((c: any) => (
                  <label key={c.id} className="nx-checkbox mb-1">
                    <input type="checkbox" checked={editing.companyIds.includes(c.id)} onChange={(e: any) => setEditing((p: any) => ({ ...p, companyIds: e.target.checked ? [...p.companyIds, c.id] : p.companyIds.filter((id: any) => id !== c.id) }))} />
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
          data={visibleUsers}
          total={visibleUsers.length}
          page={1}
          pageSize={50}
          showRowNumbers
          rowNumberWidth="1%"
          isLoading={isLoading}
          title={t('usersTab')}
          emptyMessage={
            visibleUsers.length === 0 && users.length > 0 && !showArchived
              ? t('usersArchivedHiddenEmpty')
              : t('noUsers')
          }
          renderMobileCard={(row: any) => (
            <div className="grid gap-2 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-bold text-[14px] text-noorix-text min-w-0 break-words">{row.nameAr || row.nameEn || row.email || '—'}</span>
                <Badge color={row.isActive ? 'green' : 'red'} size="sm" className="shrink-0">
                  {row.isActive ? t('active') : t('archived')}
                </Badge>
              </div>
              <div className="nx-cell-muted ltr text-right break-all">{toLoginName(row.email)}</div>
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
