/**
 * UsersTab — ????? ??????????
 */
import React, { useMemo, useState } from 'react';
import { useApiMutation } from '../../../hooks/useApiMutation';
import { useApiListQuery } from '../../../hooks/useApiQuery';
import { getUsers, createUser, updateUser, archiveUser, restoreUser, hardDeleteUser } from '../../../services/api';
import { getRoles } from '../../../services/api';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Badge, ScreenShell, SmartTable, type SmartTableColumn } from '../../../ui';
import { settingsKeys } from '../../../services/queryKeys';
import { UsersTabForms } from './UsersTabForms';
import {
  buildUserEditState,
  EMPTY_USER_FORM,
  toLoginName,
  type CreateUserResult,
  type SettingsRole,
  type SettingsUser,
  type UserEditState,
  type UserUpdateVariables,
  type UsersTabProps,
} from '../usersTabModel';

export default function UsersTab({ userRole: _userRole, activeCompanies = [] }: UsersTabProps) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  /** Archived users (isActive === false) are hidden until this is toggled on */
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<UserEditState | null>(null);
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [loginNameEdit, setLoginNameEdit] = useState('');
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);

  const { data: users = [], isLoading, isError } = useApiListQuery<SettingsUser>({
    queryKey: settingsKeys.users(),
    queryFn: getUsers,
    fallbackMessage: t('loadingError'),
  });

  const { data: roles = [] } = useApiListQuery<SettingsRole>({
    queryKey: settingsKeys.roles(),
    queryFn: getRoles,
    fallbackMessage: t('loadingError'),
  });

  const createMutation = useApiMutation({
    mutationFn: createUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: (res: CreateUserResult) => {
      const loginName = toLoginName(res?.data?.email || '');
      return loginName && loginName !== '—' ? t('userAddedWithEmail', loginName) : t('userAdded');
    },
    errorToast: (error: Error) => error.message || t('addFailed'),
    onSuccess: () => { setShowForm(false); },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({ id, body }: UserUpdateVariables) => updateUser(id, body),
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('updateSuccess'),
    errorToast: (error: Error) => error.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const archiveMutation = useApiMutation({
    mutationFn: archiveUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('userArchived'),
    errorToast: (error: Error) => error.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const restoreMutation = useApiMutation({
    mutationFn: restoreUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('userRestored'),
    errorToast: (error: Error) => error.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); },
  });

  const hardDeleteMutation = useApiMutation({
    mutationFn: hardDeleteUser,
    invalidateQueries: [settingsKeys.users()],
    successToast: () => t('userHardDeleted'),
    errorToast: (error: Error) => error.message || t('updateFailed'),
    onSuccess: () => { setEditing(null); setConfirmHardDelete(false); },
  });

  const visibleUsers = useMemo(
    () => (showArchived ? users : users.filter((user) => user.isActive !== false)),
    [users, showArchived],
  );

  function openEdit(u: SettingsUser) {
    const ln = toLoginName(u.email);
    setLoginNameEdit(ln);
    setConfirmHardDelete(false);
    setEditing(buildUserEditState(u));
  }

  const columns: SmartTableColumn<SettingsUser>[] = [
    {
      key: 'email',
      label: t('loginName'),
      render: (value, row) => (
        <Button
          variant="raw"
          size="auto"
          className="font-semibold ltr text-noorix-blue hover:underline"
          onClick={() => openEdit(row)}
        >
          {toLoginName(String(value ?? ''))}
        </Button>
      ),
    },
    {
      key: 'nameAr',
      label: t('nameAr'),
      render: (value, row) => (
        <span className={!value && !row.nameEn ? 'nx-cell-muted ltr' : ''}>
          {String(value || row.nameEn || toLoginName(row.email))}
        </span>
      ),
    },
    {
      key: 'preferredLang',
      label: t('preferredLang'),
      render: (value) => <Badge color={value === 'en' ? 'blue' : 'violet'} size="sm">{value === 'en' ? t('langEn') : t('langAr')}</Badge>,
    },
    { key: 'role', label: t('role'), render: (_value, row) => <span>{row.role?.nameAr || row.role?.name || '-'}</span> },
    {
      key: 'companies',
      label: t('companies'),
      render: (_value, row) => (
        <span className="nx-cell-muted">
          {(row.userCompanies || []).map((link) => link.company?.nameAr).filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    { key: 'status', label: t('status'), render: (_value, row) => <Badge color={row.isActive ? 'green' : 'red'} size="sm">{row.isActive ? t('active') : t('archived')}</Badge> },
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
          onClick={() => { setForm({ ...EMPTY_USER_FORM, roleName: roles[0]?.name || '' }); setShowForm(true); }}
        >
          {t('addUser')}
        </Button>
      </div>

      <UsersTabForms
        t={t}
        roles={roles}
        activeCompanies={activeCompanies}
        showForm={showForm}
        setShowForm={setShowForm}
        form={form}
        setForm={setForm}
        createMutation={createMutation}
        editing={editing}
        setEditing={setEditing}
        loginNameEdit={loginNameEdit}
        setLoginNameEdit={setLoginNameEdit}
        updateMutation={updateMutation}
        archiveMutation={archiveMutation}
        restoreMutation={restoreMutation}
        hardDeleteMutation={hardDeleteMutation}
        confirmHardDelete={confirmHardDelete}
        setConfirmHardDelete={setConfirmHardDelete}
      />

      <div className="min-w-0 w-full overflow-x-auto">
        <SmartTable
          columns={columns}
          data={visibleUsers}
          total={visibleUsers.length}
          page={1}
          pageSize={50}
          showRowNumbers
          isLoading={isLoading}
          isError={isError}
          title={t('usersTab')}
          emptyMessage={
            visibleUsers.length === 0 && users.length > 0 && !showArchived
              ? t('usersArchivedHiddenEmpty')
              : t('noUsers')
          }
          renderCompactRow={(row: SettingsUser) => (
            <div>
              <div className="nx-cr__line1">
                <span className="nx-cr__name">{row.nameAr || row.nameEn || row.email || '—'}</span>
                <span className="nx-cr__sub ltr">{toLoginName(row.email)}</span>
                <Badge color={row.isActive ? 'green' : 'red'} size="sm">
                  {row.isActive ? t('active') : t('archived')}
                </Badge>
              </div>
              <div className="nx-cr__line2">
                <div className="nx-cr__line2-start">
                  <span className="nx-cr__meta">{row.role?.nameAr || row.role?.name || '—'}</span>
                </div>
                <div className="nx-cr__line2-end">
                  <Button size="sm" onClick={() => openEdit(row)}>{t('edit')}</Button>
                </div>
              </div>
            </div>
          )}
          renderMobileCard={(row: SettingsUser) => (
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
