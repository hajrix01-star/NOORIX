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

export {
  assetExpenseLineLabel as getExpenseLineLabel,
  assetInvoiceKindLabel as getInvoiceKindLabel,
  assetSupplierDisplayName as getSupplierDisplayName,
};
