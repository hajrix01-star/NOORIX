import { toYmd } from '../../../utils/saudiDate';
import type { AssetRegisterListItem, PendingWarrantyInvoiceRow } from '../types';

export function formatAssetDate(iso: unknown): string {
  if (!iso) return '—';
  const s = toYmd(iso);
  return s || '—';
}

export function getSupplierDisplayName(
  supplier: { nameAr?: string; nameEn?: string } | null | undefined,
  lang: string,
): string {
  if (!supplier) return '—';
  return lang === 'en'
    ? supplier.nameEn || supplier.nameAr || '—'
    : supplier.nameAr || supplier.nameEn || '—';
}

export function getInvoiceKindLabel(
  kind: string | undefined,
  t: (k: string) => string,
): string {
  if (kind === 'purchase') return t('purchaseType');
  if (kind === 'fixed_expense') return t('fixedExpenseType');
  if (kind === 'expense') return t('expenseType');
  return String(kind ?? '');
}

export function getExpenseLineLabel(
  line: { nameAr?: string; nameEn?: string } | undefined,
  lang: string,
): string {
  if (!line) return '';
  return lang === 'en' ? line.nameEn || line.nameAr || '' : line.nameAr || line.nameEn || '';
}

export type RegisterListResponse = {
  items?: AssetRegisterListItem[];
  total?: number;
  sumAcquisitionCostAll?: string;
};

export function mapRegisterListResponse(data: RegisterListResponse | undefined) {
  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    sumAll: data?.sumAcquisitionCostAll ?? '0',
  };
}

export function mapPendingList(data: unknown): PendingWarrantyInvoiceRow[] {
  if (!Array.isArray(data)) return [];
  return data as PendingWarrantyInvoiceRow[];
}
