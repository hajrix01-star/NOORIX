import type { SettingsCompany } from './settingsTypes';

export type SettingsRole = {
  id: string;
  name: string;
  nameAr?: string | null;
};

export type SettingsUserCompanyLink = {
  companyId: string;
  company?: {
    nameAr?: string | null;
    nameEn?: string | null;
  } | null;
};

export type SettingsUser = {
  id: string;
  email: string;
  nameAr?: string | null;
  nameEn?: string | null;
  preferredLang?: string | null;
  role?: SettingsRole | null;
  userCompanies?: SettingsUserCompanyLink[] | null;
  isActive?: boolean | null;
};

export type UserFormState = {
  loginName: string;
  password: string;
  roleName: string;
  preferredLang: string;
  companyIds: string[];
};

export type UserEditState = {
  id: string;
  email: string;
  nameAr: string;
  nameEn: string;
  preferredLang: string;
  roleName: string;
  companyIds: string[];
  isActive: boolean;
};

export type UserUpdateVariables = {
  id: string;
  body: {
    nameAr?: string;
    nameEn?: string;
    preferredLang: string;
    roleName: string;
    companyIds: string[];
    loginName?: string;
  };
};

export type UsersTabProps = {
  userRole?: string;
  activeCompanies?: SettingsCompany[];
};

export type CreateUserResult = {
  data?: {
    email?: string | null;
  };
};

export const EMPTY_USER_FORM: UserFormState = {
  loginName: '',
  password: '',
  roleName: '',
  preferredLang: 'ar',
  companyIds: [],
};

export function toLoginName(email: string): string {
  if (!email) return '-';
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

export function isAutoGenLoginName(loginName: string): boolean {
  return /^user-[0-9a-f]{8}$/.test(loginName);
}

export function buildUserEditState(user: SettingsUser): UserEditState {
  return {
    id: user.id,
    email: user.email,
    nameAr: user.nameAr || '',
    nameEn: user.nameEn || '',
    preferredLang: user.preferredLang || 'ar',
    roleName: user.role?.name || '',
    companyIds: (user.userCompanies || []).map((link) => link.companyId),
    isActive: user.isActive !== false,
  };
}

export function buildUserUpdateBody(editing: UserEditState, loginNameEdit: string): UserUpdateVariables['body'] {
  const loginName = loginNameEdit.trim().toLowerCase();
  const body: UserUpdateVariables['body'] = {
    nameAr: editing.nameAr?.trim(),
    nameEn: editing.nameEn?.trim(),
    preferredLang: editing.preferredLang,
    roleName: editing.roleName,
    companyIds: editing.companyIds,
  };
  if (loginName && loginName !== toLoginName(editing.email)) body.loginName = loginName;
  return body;
}
