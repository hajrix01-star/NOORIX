import type { HrEmployee } from '../../../types/api';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import {
  HR_SERVICE_CATEGORY_LABEL_KEYS,
  requiresExpiryDate,
} from '../constants/employeeHrServiceCategories';

export const RESIDENCY_PAGE_SIZE = 50;
const EXPIRY_DAYS = 90;
const EMPTY_TEXT = '-';

export type ResidencyInvoiceRef = {
  id?: string | null;
  invoiceNumber?: string | null;
  totalAmount?: number | string | null;
};

export type HrResidencyRow = Record<string, unknown> & {
  id?: string | null;
  employee?: HrEmployee | null;
  employeeName?: string | null;
  serviceCategory?: string | null;
  serviceLabel?: string | null;
  iqamaNumber?: string | null;
  referenceLabel?: string | null;
  serviceDetail?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  transactionDate?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoice?: ResidencyInvoiceRef | null;
  residencyInvoiceAmount?: number | string | null;
  invoiceAmount?: number | string | null;
  status?: string | null;
};

export type ResidencyDeleteTarget = {
  id?: string | null;
  invoiceId?: string | null;
};

type TranslateFn = (key: string) => string;

export function getResidencyErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isResidencyExpiringSoon(expiryDate: unknown) {
  if (!expiryDate) return false;
  if (typeof expiryDate !== 'string' && typeof expiryDate !== 'number' && !(expiryDate instanceof Date)) return false;
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= EXPIRY_DAYS;
}

export function residencyStatusKey(value: unknown) {
  return value === 'expired' || value === 'renewed' ? value : 'active';
}

export function buildResidencyItems(rows: HrResidencyRow[] | undefined, lang: string, t: TranslateFn) {
  return (rows ?? []).map((row) => {
    const serviceCategory = row.serviceCategory || 'iqama_renewal';
    return {
      ...row,
      serviceCategory,
      employeeName: employeeDisplayName(row.employee || { name: row.employeeName }, lang),
      serviceLabel: t(HR_SERVICE_CATEGORY_LABEL_KEYS[serviceCategory] || 'hrServiceIqamaRenewal'),
      invoiceNumber: row.invoice?.invoiceNumber || null,
      invoiceAmount: row.residencyInvoiceAmount ?? row.invoice?.totalAmount,
    };
  });
}

export function filterResidenciesByCategory(items: HrResidencyRow[], categoryFilter: string) {
  if (!categoryFilter) return items;
  return items.filter((row) => row.serviceCategory === categoryFilter);
}

export function countExpiringResidencies(items: HrResidencyRow[]) {
  return items.filter(
    (row) => requiresExpiryDate(String(row.serviceCategory || '')) && isResidencyExpiringSoon(row.expiryDate),
  ).length;
}

export function buildResidencyExportData(
  rows: HrResidencyRow[],
  residencyStatusMap: Record<string, { label?: string }>,
) {
  return rows.map((row) => ({
    employeeName: row.employeeName || EMPTY_TEXT,
    service: row.serviceLabel,
    iqamaOrRef: row.iqamaNumber || row.referenceLabel || EMPTY_TEXT,
    expiryDate: row.expiryDate ? formatSaudiDate(row.expiryDate) : formatSaudiDate(row.transactionDate),
    invoiceNumber: row.invoiceNumber || EMPTY_TEXT,
    amount: row.invoiceAmount != null ? fmt(Number(row.invoiceAmount)) : EMPTY_TEXT,
    status: residencyStatusMap[String(residencyStatusKey(row.status))]?.label || row.status,
  }));
}
