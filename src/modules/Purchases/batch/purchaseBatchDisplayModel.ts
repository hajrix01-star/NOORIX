import { localizedDisplayName } from '../../../utils/vaultDisplay';
import type { PurchaseBatchLang, PurchaseBatchNamedEntity } from './purchaseBatchTypes';

export const PURCHASE_BATCH_EMPTY_VALUE = '\u2014';

export function purchaseBatchDisplayName(
  source: PurchaseBatchNamedEntity | null | undefined,
  lang: PurchaseBatchLang,
  fallback = PURCHASE_BATCH_EMPTY_VALUE,
) {
  return localizedDisplayName(source, lang, fallback);
}

export function purchaseBatchCategoryLabel(
  category: (PurchaseBatchNamedEntity & { icon?: string | null }) | null | undefined,
  lang: PurchaseBatchLang,
) {
  if (!category) return PURCHASE_BATCH_EMPTY_VALUE;
  const label = purchaseBatchDisplayName(category, lang, '');
  return `${category.icon || ''} ${label}`.trim() || PURCHASE_BATCH_EMPTY_VALUE;
}
