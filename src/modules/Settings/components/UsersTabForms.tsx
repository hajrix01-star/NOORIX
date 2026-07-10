import React, { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { AdaptiveSheet, Button, Checkbox, Input } from '../../../ui';
import type { SettingsCompany, SettingsMutationLike, TranslationFn } from '../settingsTypes';
import {
  buildUserUpdateBody,
  isAutoGenLoginName,
  toLoginName,
  type SettingsRole,
  type UserEditState,
  type UserFormState,
  type UserUpdateVariables,
} from '../usersTabModel';

type CreateUserPayload = {
  loginName: string;
  password: string;
  preferredLang: string;
  roleName?: string;
  companyIds: string[];
};

type UsersTabFormsProps = {
  t: TranslationFn;
  roles: SettingsRole[];
  activeCompanies: SettingsCompany[];
  showForm: boolean;
  setShowForm: (value: boolean) => void;
  form: UserFormState;
  setForm: Dispatch<SetStateAction<UserFormState>>;
  createMutation: SettingsMutationLike<CreateUserPayload>;
  editing: UserEditState | null;
  setEditing: Dispatch<SetStateAction<UserEditState | null>>;
  loginNameEdit: string;
  setLoginNameEdit: (value: string) => void;
  updateMutation: SettingsMutationLike<UserUpdateVariables>;
  archiveMutation: SettingsMutationLike<string>;
  restoreMutation: SettingsMutationLike<string>;
  hardDeleteMutation: SettingsMutationLike<string>;
  confirmHardDelete: boolean;
  setConfirmHardDelete: (value: boolean) => void;
};

export function UsersTabForms({
  t,
  roles,
  activeCompanies,
  showForm,
  setShowForm,
  form,
  setForm,
  createMutation,
  editing,
  setEditing,
  loginNameEdit,
  setLoginNameEdit,
  updateMutation,
  archiveMutation,
  restoreMutation,
  hardDeleteMutation,
  confirmHardDelete,
  setConfirmHardDelete,
}: UsersTabFormsProps) {
  return (
    <>
      {showForm && (
        <div className="noorix-surface-card p-5">
          <h4 className="text-[14px] m-0 mb-4">{t('newUser')}</h4>
          <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const loginName = form.loginName.trim().toLowerCase();
            if (!loginName || !form.password?.trim()) return;
            createMutation.mutate({
              loginName,
              password: form.password,
              preferredLang: form.preferredLang,
              roleName: form.roleName || roles[0]?.name,
              companyIds: form.companyIds.length ? form.companyIds : activeCompanies.map((company) => company.id),
            });
          }}>
            <div className="grid w-full min-w-0 max-w-[400px] gap-3 mb-[14px]">
              <LoginNameInput
                t={t}
                value={form.loginName}
                onChange={(value) => setForm((previous) => ({ ...previous, loginName: value }))}
                required
              />
              <Input type="password" label={`${t('password')} *`} value={form.password} onChange={(event: ChangeEvent<HTMLInputElement>) => setForm((previous) => ({ ...previous, password: event.target.value }))} required />
              <LanguageSelect t={t} value={form.preferredLang} onChange={(value) => setForm((previous) => ({ ...previous, preferredLang: value }))} />
              <RoleSelect t={t} roles={roles} value={form.roleName} onChange={(value) => setForm((previous) => ({ ...previous, roleName: value }))} />
              <CompanyCheckboxes
                t={t}
                activeCompanies={activeCompanies}
                selectedIds={form.companyIds}
                onToggle={(companyId, checked) => setForm((previous) => ({
                  ...previous,
                  companyIds: checked
                    ? [...previous.companyIds, companyId]
                    : previous.companyIds.filter((id) => id !== companyId),
                }))}
              />
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
          <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            updateMutation.mutate({ id: editing.id, body: buildUserUpdateBody(editing, loginNameEdit) });
          }}>
            <div className="grid gap-3 mb-[14px]">
              {isAutoGenLoginName(toLoginName(editing.email)) && (
                <div className="text-[12px] text-noorix-amber bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                  {t('loginNameAutoWarning')}
                </div>
              )}
              <LoginNameInput t={t} value={loginNameEdit} onChange={setLoginNameEdit} labelKey="loginNameEdit" />
              <Input type="text" label={t('nameAr')} value={editing.nameAr} onChange={(event: ChangeEvent<HTMLInputElement>) => setEditing((previous) => (previous ? { ...previous, nameAr: event.target.value } : previous))} />
              <LanguageSelect t={t} value={editing.preferredLang} onChange={(value) => setEditing((previous) => (previous ? { ...previous, preferredLang: value } : previous))} />
              <RoleSelect t={t} roles={roles} value={editing.roleName} onChange={(value) => setEditing((previous) => (previous ? { ...previous, roleName: value } : previous))} />
              <CompanyCheckboxes
                t={t}
                activeCompanies={activeCompanies}
                selectedIds={editing.companyIds}
                onToggle={(companyId, checked) => setEditing((previous) => (previous ? {
                  ...previous,
                  companyIds: checked
                    ? [...previous.companyIds, companyId]
                    : previous.companyIds.filter((id) => id !== companyId),
                } : previous))}
              />
            </div>
            <UserEditActions
              t={t}
              editing={editing}
              updateMutation={updateMutation}
              archiveMutation={archiveMutation}
              restoreMutation={restoreMutation}
              hardDeleteMutation={hardDeleteMutation}
              confirmHardDelete={confirmHardDelete}
              setConfirmHardDelete={setConfirmHardDelete}
              setEditing={setEditing}
            />
          </form>
        )}
      </AdaptiveSheet>
    </>
  );
}

function LoginNameInput({
  t,
  value,
  onChange,
  required,
  labelKey = 'loginName',
}: {
  t: TranslationFn;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  labelKey?: string;
}) {
  return (
    <div>
      <Input
        type="text"
        label={required ? `${t(labelKey)} *` : t(labelKey)}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
        dir="ltr"
        placeholder={t('loginNamePlaceholder')}
        required={required}
      />
      <p className="text-[11px] text-noorix-muted mt-1 mb-0">{t('loginNameValidation')}</p>
    </div>
  );
}

function LanguageSelect({ t, value, onChange }: { t: TranslationFn; value: string; onChange: (value: string) => void }) {
  return (
    <Input type="select" label={t('preferredLang')} value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
      <option value="ar">{t('langAr')}</option>
      <option value="en">{t('langEn')}</option>
    </Input>
  );
}

function RoleSelect({ t, roles, value, onChange }: { t: TranslationFn; roles: SettingsRole[]; value: string; onChange: (value: string) => void }) {
  return (
    <Input type="select" label={t('role')} value={value} onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
      {roles.map((role) => <option key={role.id} value={role.name}>{role.nameAr || role.name}</option>)}
    </Input>
  );
}

function CompanyCheckboxes({
  t,
  activeCompanies,
  selectedIds,
  onToggle,
}: {
  t: TranslationFn;
  activeCompanies: SettingsCompany[];
  selectedIds: string[];
  onToggle: (companyId: string, checked: boolean) => void;
}) {
  return (
    <div>
      <label className="text-[12px] font-semibold mb-1 block">{t('companies')}</label>
      <div className="flex flex-col gap-1.5">
        {activeCompanies.map((company) => (
          <Checkbox
            key={company.id}
            checked={selectedIds.includes(company.id)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onToggle(company.id, event.target.checked)}
            label={company.nameAr}
            containerClassName="nx-checkbox"
          />
        ))}
      </div>
    </div>
  );
}

function UserEditActions({
  t,
  editing,
  updateMutation,
  archiveMutation,
  restoreMutation,
  hardDeleteMutation,
  confirmHardDelete,
  setConfirmHardDelete,
  setEditing,
}: {
  t: TranslationFn;
  editing: UserEditState;
  updateMutation: SettingsMutationLike<UserUpdateVariables>;
  archiveMutation: SettingsMutationLike<string>;
  restoreMutation: SettingsMutationLike<string>;
  hardDeleteMutation: SettingsMutationLike<string>;
  confirmHardDelete: boolean;
  setConfirmHardDelete: (value: boolean) => void;
  setEditing: Dispatch<SetStateAction<UserEditState | null>>;
}) {
  return (
    <div className="flex flex-col gap-2 min-[440px]:flex-row min-[440px]:flex-wrap">
      <Button type="submit" variant="primary" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('saving') : t('save')}</Button>
      <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => setEditing(null)}>{t('close')}</Button>
      {editing.isActive ? (
        <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => archiveMutation.mutate(editing.id)} disabled={archiveMutation.isPending}>{t('archive')}</Button>
      ) : (
        <>
          <Button type="button" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => restoreMutation.mutate(editing.id)} disabled={restoreMutation.isPending}>{t('restore')}</Button>
          {!confirmHardDelete ? (
            <Button type="button" variant="danger" className="w-full min-h-[44px] min-[440px]:w-auto min-[440px]:min-h-0" onClick={() => setConfirmHardDelete(true)}>{t('hardDelete')}</Button>
          ) : (
            <div className="flex flex-col gap-1.5 w-full min-[440px]:w-auto">
              <p className="text-[12px] text-noorix-red font-semibold m-0">{t('hardDeleteConfirm')}</p>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="danger" className="flex-1 min-[440px]:flex-none" onClick={() => hardDeleteMutation.mutate(editing.id)} disabled={hardDeleteMutation.isPending}>{hardDeleteMutation.isPending ? t('deleting') : t('hardDeleteConfirmYes')}</Button>
                <Button type="button" className="flex-1 min-[440px]:flex-none" onClick={() => setConfirmHardDelete(false)}>{t('cancel')}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
