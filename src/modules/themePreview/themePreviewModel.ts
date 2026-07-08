import type { ReactNode } from 'react';
import type { MatrixTableColumn, SimpleTableColumn, SmartTableColumn } from '../../ui';

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

export type ThemePreviewContainerRow = {
  id: string;
  label: string;
  owner: string;
  status: string;
  amount: number;
  tax: number;
  date: string;
};

export type ThemePreviewMatrixRow = {
  id: string;
  item: string;
  jan: number;
  feb: number;
  total: number;
  tone?: 'default' | 'group' | 'summary' | 'total' | 'muted';
};

export const THEME_PREVIEW_TABLE_ROWS: ThemePreviewTableRow[] = [
  { id: '1', name: 'عنصر أ', qty: 2, price: '100.00' },
  { id: '2', name: 'عنصر ب', qty: 1, price: '250.50' },
];

export const THEME_PREVIEW_CONTAINER_ROWS: ThemePreviewContainerRow[] = [
  { id: 'INV-001', label: 'Sample invoice', owner: 'Operations', status: 'active', amount: 1150, tax: 150, date: '2026-07-08' },
  { id: 'SAL-002', label: 'Daily sales', owner: 'Cashier', status: 'posted', amount: 2300, tax: 300, date: '2026-07-08' },
  { id: 'EXP-003', label: 'Fixed expense', owner: 'Accounting', status: 'review', amount: 575, tax: 75, date: '2026-07-07' },
];

export const THEME_PREVIEW_MATRIX_ROWS: ThemePreviewMatrixRow[] = [
  { id: 'sales', item: 'Revenue', jan: 12000, feb: 14800, total: 26800, tone: 'group' },
  { id: 'purchases', item: 'Purchases', jan: 4200, feb: 5100, total: 9300 },
  { id: 'expenses', item: 'Expenses', jan: 2100, feb: 2300, total: 4400 },
  { id: 'net', item: 'Net result', jan: 5700, feb: 7400, total: 13100, tone: 'total' },
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

export function buildThemePreviewContainerSmartColumns(): SmartTableColumn<ThemePreviewContainerRow>[] {
  return [
    { key: 'id', kind: 'id', label: 'Document', sortable: true, width: '13ch' },
    { key: 'label', kind: 'text', label: 'Name', sortable: true },
    { key: 'owner', kind: 'meta', label: 'Owner', sortable: true, width: '16ch' },
    { key: 'date', kind: 'date', label: 'Date', sortable: true, width: '13ch' },
    { key: 'tax', kind: 'money', label: 'Tax', numeric: true, sortable: true, width: '11ch' },
    { key: 'amount', kind: 'money', label: 'Total', numeric: true, sortable: true, width: '12ch' },
    { key: 'status', kind: 'status', label: 'Status', sortable: true, width: '12ch' },
  ];
}

export function buildThemePreviewContainerSimpleColumns(): SimpleTableColumn<ThemePreviewContainerRow>[] {
  return [
    { key: 'label', label: 'Line', minWidth: 180 },
    { key: 'date', label: 'Date', minWidth: 120, align: 'center' },
    { key: 'amount', label: 'Amount', numeric: true, minWidth: 120 },
    { key: 'tax', label: 'Tax', numeric: true, minWidth: 100 },
    { key: 'status', label: 'State', align: 'center', minWidth: 120 },
  ];
}

export function buildThemePreviewContainerMatrixColumns(): MatrixTableColumn<ThemePreviewMatrixRow>[] {
  return [
    { key: 'item', label: 'Metric', minWidth: 180 },
    { key: 'jan', label: 'Jan', numeric: true, minWidth: 120 },
    { key: 'feb', label: 'Feb', numeric: true, minWidth: 120 },
    { key: 'total', label: 'Total', numeric: true, minWidth: 130 },
  ];
}
