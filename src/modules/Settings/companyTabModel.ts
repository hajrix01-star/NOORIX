import type { SettingsCompany } from './settingsTypes';

export type CompanyCreateBody = {
  nameAr: string;
  nameEn?: string;
  taxNumber?: string;
  phone?: string;
  address?: string;
  email?: string;
  logoUrl?: string;
};

export type CompanyUpdateVariables = {
  id: string;
  body: Record<string, unknown>;
};

export type CompanyMutationResult = {
  data?: SettingsCompany;
  id?: string;
};

export type CompanyUpdateResult = {
  data?: unknown;
};

export type CompanyEditModal = SettingsCompany & {
  id: string;
  nameAr: string;
  nameEn: string;
  taxNumber: string;
  phone: string;
  address: string;
  email: string;
  logoUrl: string;
  isArchived: boolean;
  _initial: {
    nameEn: string;
    taxNumber: string;
    phone: string;
    address: string;
    email: string;
    logoUrl: string;
  };
};

export type ResetCompanyCategoriesResult = {
  success?: boolean;
  error?: string;
  data?: {
    deleted?: {
      categories?: number;
      oldAccounts?: number;
    };
    created?: {
      categories?: number;
    };
  };
};

export type CompanyAddFormState = {
  nameAr: string;
  nameEn: string;
  taxNumber: string;
  phone: string;
  address: string;
  email: string;
  logoUrl: string;
};

export const EMPTY_COMPANY_ADD_FORM: CompanyAddFormState = {
  nameAr: '',
  nameEn: '',
  taxNumber: '',
  phone: '',
  address: '',
  email: '',
  logoUrl: '',
};

export function buildCompanyCreateBody(form: CompanyAddFormState): CompanyCreateBody {
  return {
    nameAr: form.nameAr.trim(),
    nameEn: form.nameEn.trim() || undefined,
    taxNumber: form.taxNumber.trim() || undefined,
    phone: form.phone.trim() || undefined,
    address: form.address.trim() || undefined,
    email: form.email.trim() || undefined,
    logoUrl: form.logoUrl.trim() || undefined,
  };
}

export function buildCompanyEditModal(company: SettingsCompany): CompanyEditModal {
  return {
    id: company.id,
    nameAr: company.nameAr || '',
    nameEn: company.nameEn || '',
    taxNumber: company.taxNumber || '',
    phone: company.phone || '',
    address: company.address || '',
    email: company.email || '',
    logoUrl: company.logoUrl || '',
    isArchived: !!company.isArchived,
    _initial: {
      nameEn: company.nameEn || '',
      taxNumber: company.taxNumber || '',
      phone: company.phone || '',
      address: company.address || '',
      email: company.email || '',
      logoUrl: company.logoUrl || '',
    },
  };
}

export function resetCompanyCategoriesSuccessMessage(result: ResetCompanyCategoriesResult) {
  const data = result.data;
  return `✅ تم — حُذفت ${data?.deleted?.categories ?? 0} فئة و${data?.deleted?.oldAccounts ?? 0} حساب قديم. أُنشئت ${data?.created?.categories ?? 0} فئة جديدة.`;
}
