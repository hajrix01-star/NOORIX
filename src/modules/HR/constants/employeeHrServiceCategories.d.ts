export type HrServiceCategory =
  | 'iqama_new'
  | 'iqama_renewal'
  | 'sponsorship_transfer'
  | 'exit_reentry_visa'
  | 'flight_ticket'
  | 'medical_insurance'
  | 'health_certificate';

export const HR_SERVICE_CATEGORIES: HrServiceCategory[];
export const HR_SERVICE_QUICK_ADD: HrServiceCategory[];
export const HR_SERVICE_CATEGORY_LABEL_KEYS: Record<string, string>;
export const VISA_DURATION_MONTHS: number[];

export function requiresIqamaNumber(category: HrServiceCategory | string): boolean;
export function showsReferenceLabel(category: HrServiceCategory | string): boolean;
export function requiresReferenceLabel(category: HrServiceCategory | string): boolean;
export function requiresExpiryDate(category: HrServiceCategory | string): boolean;
export function showsIssueDate(category: HrServiceCategory | string): boolean;
export function showsVisaDurationMonths(category: HrServiceCategory | string): boolean;
export function requiresVisaDurationMonths(category: HrServiceCategory | string): boolean;
export function parseVisaDurationMonths(value: unknown): string;
export function visaDurationLabel(months: unknown, t: (key: string, ...args: string[]) => string): string;
export function formatHrServiceDetail(row: unknown, t: (key: string, ...args: string[]) => string): string;
export function formatHrServiceSecondaryDate(
  row: unknown,
  t: (key: string, ...args: string[]) => string,
  formatSaudiDate: (value: unknown) => string,
): string;
export function isSponsorshipTransfer(category: HrServiceCategory | string): boolean;
export function usesCompanyAsSponsor(category: HrServiceCategory | string): boolean;
export function referenceLabelKey(category: HrServiceCategory | string): string;
export function isHealthCertificate(category: HrServiceCategory | string): boolean;
export function addOneCalendarYearYmd(value: string | null | undefined): string;
export function companyDisplayName(company: unknown, lang?: string): string;
