import { toYmd } from '../../../utils/saudiDate';
import {
  assetExpenseLineLabel,
  assetInvoiceKindLabel,
  assetSupplierDisplayName,
} from '../assetsRegisterModel';

export function formatAssetDate(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const value = toYmd(iso);
  return value || '-';
}

export function formatWarrantyDuration(months: number | null | undefined, lang: string): string {
  if (months == null || !Number.isFinite(months) || months <= 0) return '-';
  if (lang === 'en') {
    if (months % 12 === 0) {
      const years = months / 12;
      return years === 1 ? '1 year' : `${years} years`;
    }
    return months === 1 ? '1 month' : `${months} months`;
  }
  if (months % 12 === 0) {
    const years = months / 12;
    if (years === 1) return 'سنة';
    if (years === 2) return 'سنتان';
    return `${years} سنوات`;
  }
  if (months === 1) return 'شهر';
  if (months === 2) return 'شهران';
  return `${months} شهر`;
}

export {
  assetExpenseLineLabel as getExpenseLineLabel,
  assetInvoiceKindLabel as getInvoiceKindLabel,
  assetSupplierDisplayName as getSupplierDisplayName,
};
