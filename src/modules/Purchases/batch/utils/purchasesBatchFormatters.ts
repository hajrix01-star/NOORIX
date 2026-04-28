import type { BatchTranslateFn } from '../types';

/** Footer label for batches table — same fallback string as before */
export function formatBatchesFooterLabel(
  t: BatchTranslateFn,
  activeOnlyCount: number,
): string {
  return t('totalBatches', activeOnlyCount) || `الإجمالي (${activeOnlyCount} دفعة)`;
}
