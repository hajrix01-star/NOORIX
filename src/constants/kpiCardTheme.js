/**
 * kpiCardTheme.js — المصدر الواحد لألوان جميع الكروت في النظام
 *
 * أي تغيير في الألوان يتم هنا وينعكس على كل الشاشات تلقائياً:
 *  - كروت KPI (لوحة التحكم + المالك + التقارير + مبيعات التطبيق)
 *  - كروت الخزائن (نقدي / بنك / تطبيق)
 */

/* ── كروت KPI المالية ────────────────────────────────────────── */
export const KPI_CARD_SPARKLINE_COLORS = {
  sales:       '#185FA5',
  grossProfit: '#3B6D11',
  netProfit:   '#854F0B',
  purchases:   '#888780',
  expenses:    '#A32D2D',
};

/* ── كروت الخزائن ────────────────────────────────────────────── */
export const VAULT_TYPE_COLORS = {
  cash: '#16a34a',
  bank: '#2563eb',
  app:  '#7c3aed',
};

export const VAULT_TYPE_BG = {
  cash: 'rgba(22,163,74,0.10)',
  bank: 'rgba(37,99,235,0.10)',
  app:  'rgba(124,58,237,0.10)',
};

/** @deprecated استخدم KPI_CARD_TOP_BAR_CLASS عبر MetricCard.color مباشرة */
export const KPI_CARD_TOP_BAR_CLASS = {
  sales:       'bg-[#185FA5]',
  grossProfit: 'bg-[#3B6D11]',
  netProfit:   'bg-[#854F0B]',
  purchases:   'bg-[#888780]',
  expenses:    'bg-[#A32D2D]',
};
