import { getSaudiToday, toYmd } from '../../utils/saudiDate';
import { localizedDisplayName } from '../../utils/displayName';
import type {
  AssetCompleteFromInvoicePayload,
  AssetCreatePayload,
  AssetRegisterItem,
  AssetRegisterPage,
  AssetSupplierRef,
  AssetUpdatePayload,
  AssetWarrantyFilter,
  AssetWarrantyLinePayload,
  AssetWarrantyStatus,
  PendingWarrantyInvoiceRow,
} from '../../types/api';

export type AssetsLang = 'ar' | 'en' | string;
export type AssetTranslationFn = (key: string) => string;

export type AssetFormState = {
  nameAr: string;
  nameEn: string;
  serialNumber: string;
  location: string;
  purchaseDate: string;
  acquisitionCost: string;
  supplierId: string;
  warrantyDescription: string;
  warrantyMonths: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  notes: string;
};

export type AssetWarrantyLineFormRow = {
  key: string;
  nameAr: string;
  nameEn: string;
  quantity: string;
  notes: string;
};

type AssetMutablePayload = Omit<AssetCreatePayload, 'companyId' | 'invoiceId' | 'warrantyLines'>;

export const ASSET_WARRANTY_FILTERS: AssetWarrantyFilter[] = ['all', 'active', 'expiring90', 'expired', 'none'];

export function parseAssetWarrantyFilter(value: string): AssetWarrantyFilter {
  for (const filter of ASSET_WARRANTY_FILTERS) {
    if (filter === value) return filter;
  }
  return 'all';
}

export function emptyAssetForm(): AssetFormState {
  return {
    nameAr: '',
    nameEn: '',
    serialNumber: '',
    location: '',
    purchaseDate: getSaudiToday(),
    acquisitionCost: '',
    supplierId: '',
    warrantyDescription: '',
    warrantyMonths: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    notes: '',
  };
}

export function initAssetForm(initial: AssetRegisterItem | null): AssetFormState {
  if (!initial) return emptyAssetForm();
  return {
    nameAr: initial.nameAr,
    nameEn: initial.nameEn ?? '',
    serialNumber: initial.serialNumber ?? '',
    location: initial.location ?? '',
    purchaseDate: initial.purchaseDate ? toYmd(initial.purchaseDate) : getSaudiToday(),
    acquisitionCost: initial.acquisitionCost != null ? String(initial.acquisitionCost) : '',
    supplierId: initial.supplier?.id ?? '',
    warrantyDescription: initial.warrantyDescription ?? '',
    warrantyMonths: initial.warrantyMonths != null ? String(initial.warrantyMonths) : '',
    warrantyStartDate: initial.warrantyStartDate ? toYmd(initial.warrantyStartDate) : '',
    warrantyEndDate: initial.warrantyEndDate ? toYmd(initial.warrantyEndDate) : '',
    notes: initial.notes ?? '',
  };
}

export function initAssetFormFromInvoice(invoice: PendingWarrantyInvoiceRow, lang: AssetsLang): AssetFormState {
  const tx = toYmd(invoice.transactionDate);
  const supplierName = assetSupplierDisplayName(invoice.supplier, lang, '');
  const ref = invoice.supplierInvoiceNumber || invoice.invoiceNumber || '';
  return {
    ...emptyAssetForm(),
    nameAr: supplierName && ref ? `${supplierName} - ${ref}` : supplierName || String(ref || ''),
    purchaseDate: tx || getSaudiToday(),
    acquisitionCost: invoice.totalAmount != null ? String(invoice.totalAmount) : '',
    notes: invoice.notes?.trim() || '',
  };
}

export function createWarrantyLineRow(key: string): AssetWarrantyLineFormRow {
  return { key, nameAr: '', nameEn: '', quantity: '', notes: '' };
}

export function nextWarrantyLineKey(invoiceId: string, rows: readonly AssetWarrantyLineFormRow[]): string {
  const max = rows.reduce((out, row) => {
    const suffix = Number(row.key.split('-').at(-1));
    return Number.isFinite(suffix) ? Math.max(out, suffix) : out;
  }, -1);
  return `${invoiceId}-${max + 1}`;
}

export function buildWarrantyLinePayload(rows: readonly AssetWarrantyLineFormRow[]): AssetWarrantyLinePayload[] {
  return rows
    .filter((line) => line.nameAr.trim())
    .map((line) => ({
      nameAr: line.nameAr.trim(),
      ...(line.nameEn.trim() ? { nameEn: line.nameEn.trim() } : {}),
      ...(line.quantity.trim() && !Number.isNaN(Number(line.quantity)) ? { quantity: Number(line.quantity) } : {}),
      ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
    }));
}

export function validateAssetForm(form: AssetFormState): string | null {
  if (!form.nameAr.trim()) return 'assetName';
  const cost = parseOptionalMoney(form.acquisitionCost);
  if (form.acquisitionCost.trim() && (cost == null || cost < 0)) return 'validationInvalidAmount';
  const months = parseOptionalInteger(form.warrantyMonths);
  if (form.warrantyMonths.trim() && (months == null || months < 0)) return 'validationInvalidAmount';
  return null;
}

export function buildAssetCreatePayload(form: AssetFormState, companyId: string): AssetCreatePayload {
  return {
    companyId,
    ...buildAssetMutablePayload(form),
  };
}

export function buildAssetUpdatePayload(form: AssetFormState): AssetUpdatePayload {
  return buildAssetMutablePayload(form);
}

export function buildAssetCompletePayload(
  form: AssetFormState,
  companyId: string,
  invoiceId: string,
  warrantyLines: readonly AssetWarrantyLineFormRow[],
): AssetCompleteFromInvoicePayload {
  const lines = buildWarrantyLinePayload(warrantyLines);
  return {
    ...buildAssetCreatePayload(form, companyId),
    invoiceId,
    ...(lines.length ? { warrantyLines: lines } : {}),
  };
}

export function assetSupplierDisplayName(
  supplier: Pick<AssetSupplierRef, 'nameAr' | 'nameEn'> | null | undefined,
  lang: AssetsLang,
  empty = '-',
): string {
  return localizedDisplayName(supplier, lang, empty);
}

export function assetDisplayName(asset: Pick<AssetRegisterItem, 'nameAr' | 'nameEn'>, lang: AssetsLang): string {
  return localizedDisplayName(asset, lang, '');
}

export function assetInvoiceKindLabel(kind: PendingWarrantyInvoiceRow['kind'] | undefined, t: AssetTranslationFn): string {
  if (kind === 'purchase') return t('purchaseType');
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  if (kind === 'expense') return t('expenseType');
  return String(kind ?? '');
}

export function assetExpenseLineLabel(
  line: PendingWarrantyInvoiceRow['expenseLine'] | undefined,
  lang: AssetsLang,
): string {
  if (!line) return '';
  return localizedDisplayName(line, lang, '');
}

export function normalizeAssetRegisterPage(data: AssetRegisterPage | undefined): AssetRegisterPage {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 50,
    sumAcquisitionCostFiltered: data?.sumAcquisitionCostFiltered ?? '0',
    sumAcquisitionCostAll: data?.sumAcquisitionCostAll ?? '0',
  };
}

export function normalizePendingWarrantyRows(data: PendingWarrantyInvoiceRow[] | undefined): PendingWarrantyInvoiceRow[] {
  return Array.isArray(data) ? data : [];
}

export function normalizeWarrantyStatus(value: string | null | undefined): AssetWarrantyStatus {
  if (value === 'active' || value === 'expiring' || value === 'expired') return value;
  return 'none';
}

function buildAssetMutablePayload(form: AssetFormState): AssetMutablePayload {
  const acquisitionCost = parseOptionalMoney(form.acquisitionCost);
  const warrantyMonths = parseOptionalInteger(form.warrantyMonths);
  return {
    nameAr: form.nameAr.trim(),
    ...(form.nameEn.trim() ? { nameEn: form.nameEn.trim() } : {}),
    ...(form.serialNumber.trim() ? { serialNumber: form.serialNumber.trim() } : {}),
    ...(form.location.trim() ? { location: form.location.trim() } : {}),
    ...(form.purchaseDate.trim() ? { purchaseDate: form.purchaseDate.trim() } : {}),
    ...(acquisitionCost != null ? { acquisitionCost } : {}),
    ...(form.supplierId ? { supplierId: form.supplierId } : {}),
    ...(form.warrantyDescription.trim() ? { warrantyDescription: form.warrantyDescription.trim() } : {}),
    ...(warrantyMonths != null ? { warrantyMonths } : {}),
    ...(form.warrantyStartDate.trim() ? { warrantyStartDate: form.warrantyStartDate.trim() } : {}),
    ...(form.warrantyEndDate.trim() ? { warrantyEndDate: form.warrantyEndDate.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}

function parseOptionalMoney(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}
