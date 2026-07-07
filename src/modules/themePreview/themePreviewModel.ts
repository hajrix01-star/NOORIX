import type { ReactNode } from 'react';
import type { SmartTableColumn } from '../../ui';

export type ThemePreviewTranslate = (key: string) => string;

export type ThemePreviewLabBlockProps = {
  num: number;
  title: string;
  hint?: string;
  children: ReactNode;
};

export type ThemePreviewDemoTabId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

export type ThemePreviewDemoTabDef = {
  id: ThemePreviewDemoTabId;
  labelKey: string;
  contentKey: string;
};

export type ThemePreviewTableRow = {
  id: string;
  name: string;
  qty: number;
  price: string;
};

export const THEME_PREVIEW_TABLE_ROWS: ThemePreviewTableRow[] = [
  { id: '1', name: 'عنصر أ', qty: 2, price: '100.00' },
  { id: '2', name: 'عنصر ب', qty: 1, price: '250.50' },
];

export const THEME_PREVIEW_DEMO_TAB_DEFS: ThemePreviewDemoTabDef[] = [
  { id: 'a', labelKey: 'themePreviewLabDemoTabA', contentKey: 'themePreviewLab3ContentA' },
  { id: 'b', labelKey: 'themePreviewLabDemoTabB', contentKey: 'themePreviewLab3ContentB' },
  { id: 'c', labelKey: 'themePreviewLabDemoTabC', contentKey: 'themePreviewLab3ContentC' },
  { id: 'd', labelKey: 'themePreviewLabDemoTabD', contentKey: 'themePreviewLab3ContentD' },
  { id: 'e', labelKey: 'themePreviewLabDemoTabE', contentKey: 'themePreviewLab3ContentE' },
  { id: 'f', labelKey: 'themePreviewLabDemoTabF', contentKey: 'themePreviewLab3ContentF' },
  { id: 'g', labelKey: 'themePreviewLabDemoTabG', contentKey: 'themePreviewLab3ContentG' },
];

export function buildThemePreviewDemoTabs(t: ThemePreviewTranslate) {
  return THEME_PREVIEW_DEMO_TAB_DEFS.map((row) => ({ id: row.id, label: t(row.labelKey) }));
}

export function getThemePreviewDemoContentKey(tabId: string): string {
  return THEME_PREVIEW_DEMO_TAB_DEFS.find((row) => row.id === tabId)?.contentKey ?? 'themePreviewLab3ContentA';
}

export function buildThemePreviewTableColumns(t: ThemePreviewTranslate): SmartTableColumn<ThemePreviewTableRow>[] {
  return [
    { key: 'name', header: t('themePreviewLabColName'), sortable: true },
    { key: 'qty', header: t('themePreviewLabColQty'), sortable: true, cellClassName: 'ltr text-end' },
    { key: 'price', header: t('themePreviewLabColPrice'), sortable: false, cellClassName: 'ltr text-end' },
  ];
}
