import type { BatchTranslateFn } from '../types';

export function formatBatchesFooterLabel(
  t: BatchTranslateFn,
  activeOnlyCount: number,
): string {
  return t('totalBatches', activeOnlyCount) || `الإجمالي (${activeOnlyCount} دفعة)`;
}
