import { formatMoney } from '../../../utils/money';
import { formatAssetDate, getSupplierDisplayName } from './assetsRegisterMappers';
import type { AssetRegisterListItem } from '../types';

/**
 * صفوف جاهزة لتصدير CSV/Excel (رؤوس + بيانات) — نفس ترتيب الأعمدة المعروضة في الجدول.
 */
export function buildAssetRegisterExportRows(
  items: AssetRegisterListItem[],
  t: (k: string) => string,
  lang: string,
): { headers: string[]; rows: string[][] } {
  const headers = [
    t('assetName'),
    t('assetSerial'),
    t('assetPurchaseDate'),
    t('assetAcquisitionCost'),
    t('assetSupplier'),
    t('assetWarrantyEnd'),
    t('assetWarrantyFilter'),
    t('assetDaysToEnd'),
  ];
  const rows = items.map((row) => {
    const name =
      (lang === 'en' ? row.nameEn || row.nameAr : row.nameAr || row.nameEn) || '';
    const cost =
      row.acquisitionCost != null && row.acquisitionCost !== ''
        ? formatMoney(row.acquisitionCost, lang)
        : '—';
    return [
      name,
      String(row.serialNumber || '—'),
      formatAssetDate(row.purchaseDate),
      cost,
      getSupplierDisplayName(row.supplier, lang),
      formatAssetDate(row.warrantyEndDate),
      String(row.warrantyStatus ?? '—'),
      row.daysToWarrantyEnd != null ? String(row.daysToWarrantyEnd) : '—',
    ];
  });
  return { headers, rows };
}
