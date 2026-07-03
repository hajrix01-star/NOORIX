import type { CSSProperties } from 'react';
import type { AnalysisCardId } from './bankAnalysisTab.types';

export const BAR_CHART_TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  fontSize: 12,
  direction: 'rtl',
};

export const ANALYSIS_CARD_COLORS = [
  'var(--noorix-accent-blue)',
  'var(--noorix-accent-green)',
  '#ca8a04',
  'var(--noorix-accent-red)',
  'var(--noorix-accent-violet)',
  '#0891b2',
  '#db2777',
  'var(--noorix-accent-violet)',
  '#ea580c',
  '#84cc16',
];

export function analysisCardColorClass(index: number) {
  const safeIndex = Number.isFinite(index) ? index : 0;
  return `nx-analysis-color-${Math.abs(safeIndex) % ANALYSIS_CARD_COLORS.length}`;
}

export const RED_PIE_TINTS = [
  'var(--noorix-accent-red)',
  'var(--noorix-accent-red)',
  'var(--noorix-accent-red)',
  'var(--color-danger-bg)',
  '#f87171',
];
export const GREEN_PIE_TINTS = [
  'var(--noorix-accent-green)',
  'var(--noorix-accent-green)',
  'var(--noorix-accent-green)',
  'var(--noorix-accent-green)',
  '#4ade80',
];

/** جداول كبيرة بعرض الصف كاملاً */
export const ANALYSIS_CARD_FULL_WIDTH = new Set<AnalysisCardId>([
  'category_table',
  'deposits_table',
  'pos_terminals',
]);
