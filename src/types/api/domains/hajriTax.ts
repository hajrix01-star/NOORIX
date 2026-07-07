import type { TaxDisclosureData } from '../../../constants/taxDisclosure';

export type HajriTaxQuarter = 1 | 2 | 3 | 4;

export type HajriTaxCompanyRef = {
  id: string;
  nameAr?: string | null;
  nameEn?: string | null;
  name?: string | null;
  taxNumber?: string | null;
  isArchived?: boolean | null;
  vatRatePercent?: number | string | null;
};

export type VatPlanningSourceSnapshot = Record<string, unknown> & {
  source?: string;
  importedFromTaxReport?: boolean;
  importedAt?: string;
  submitted?: boolean;
};

export type VatPlanningRecord = {
  id: string;
  companyId: string;
  year: number;
  quarter: HajriTaxQuarter;
  payload: TaxDisclosureData;
  sourceSnapshot?: VatPlanningSourceSnapshot | null;
  paymentTarget?: string | number | null;
  notes?: string | null;
  importedAt?: string | null;
  filingSubmitted?: boolean;
  updatedAt?: string | null;
  company?: HajriTaxCompanyRef | null;
};

export type VatPlanningRegistryFilters = {
  year?: string | number;
  quarter?: string | number;
  companyId?: string;
};

export type VatPlanningRegistryMetadata = {
  companies: HajriTaxCompanyRef[];
  years: number[];
};

export type VatPlanningUpsertPayload = {
  companyId: string;
  year: number;
  quarter: HajriTaxQuarter;
  payload: TaxDisclosureData;
  sourceSnapshot?: VatPlanningSourceSnapshot | null;
  paymentTarget?: number | null;
  notes?: string | null;
  importedAt?: string | null;
  filingSubmitted?: boolean;
};

export type HajriTaxCellEdit = {
  id: string;
  text: string;
};

export type HajriTaxNewDeclarationRequest = {
  companyId: string;
  year: number;
  quarter: HajriTaxQuarter;
};

export type HajriTaxLanguage = 'ar' | 'en' | string;

export type HajriTaxTranslate = (key: string, params?: Record<string, string>) => string;
