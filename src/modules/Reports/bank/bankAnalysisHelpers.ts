import { RED_PIE_TINTS, GREEN_PIE_TINTS } from './bankAnalysisConstants';
import type { PieDisplayMode } from './bankAnalysisTab.types';

export function pieSliceFill(
  mode: PieDisplayMode,
  index: number,
  item: { debit?: number; credit?: number },
): string {
  if (mode === 'combined') {
    const pal = (item.debit || 0) >= (item.credit || 0) ? RED_PIE_TINTS : GREEN_PIE_TINTS;
    return pal[index % pal.length];
  }
  if (mode === 'debit') return RED_PIE_TINTS[index % RED_PIE_TINTS.length];
  return GREEN_PIE_TINTS[index % GREEN_PIE_TINTS.length];
}

export function truncateLabel(str: unknown, max = 20): string {
  const s = String(str || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function estimateYAxisWidth(labels: string[], minW = 140, maxW = 280): number {
  if (!labels.length) return minW;
  const longest = Math.max(...labels.map((x) => String(x).length));
  return Math.min(maxW, Math.max(minW, 12 + Math.round(longest * 7.2)));
}
