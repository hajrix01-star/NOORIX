/**
 * kpiCardTheme.js — مرآة Design Tokens
 *
 * المصدر الحقيقي الوحيد: @theme في src/index.css (--color-nx-*)
 *
 * هذا الملف يوفّر الألوان بصيغتين:
 *
 *  1. CSS variables → للـ MetricCard + inline styles + CSS contexts
 *     KPI_CARD_SPARKLINE_COLORS  /  VAULT_TYPE_COLORS
 *
 *  2. Hex literals → للـ Recharts الذي لا يدعم var() كـ stroke/fill
 *     KPI_RECHARTS_COLORS  /  VAULT_RECHARTS_COLORS
 *
 * ⚠️ عند تغيير أي لون: غيّره في @theme أولاً ثم حدّث الـ hex هنا.
 */

/* ══ CSS variables (للكروت والـ inline styles) ══════════════════ */

export const KPI_CARD_SPARKLINE_COLORS = {
  sales:       'var(--color-nx-sales)',
  grossProfit: 'var(--color-nx-profit)',
  netProfit:   'var(--color-nx-net-profit)',
  purchases:   'var(--color-nx-purchases)',
  expenses:    'var(--color-nx-expenses)',
};

export const VAULT_TYPE_COLORS = {
  cash: 'var(--color-nx-vault-cash)',
  bank: 'var(--color-nx-vault-bank)',
  app:  'var(--color-nx-vault-app)',
};

export const VAULT_TYPE_BG = {
  cash: 'color-mix(in srgb, var(--color-nx-vault-cash) 10%, transparent)',
  bank: 'color-mix(in srgb, var(--color-nx-vault-bank) 10%, transparent)',
  app:  'color-mix(in srgb, var(--color-nx-vault-app)  10%, transparent)',
};

/* ══ Hex literals (للـ Recharts فقط) ════════════════════════════ */

export const KPI_RECHARTS_COLORS = {
  sales:       '#185FA5',
  grossProfit: '#3B6D11',
  netProfit:   '#854F0B',
  purchases:   '#888780',
  expenses:    '#A32D2D',
};

export const VAULT_RECHARTS_COLORS = {
  cash: '#16a34a',
  bank: '#2563eb',
  app:  '#7c3aed',
};

/** @deprecated — استُبدل بـ MetricCard.color prop مباشرة */
export const KPI_CARD_TOP_BAR_CLASS = {
  sales:       'bg-[#185FA5]',
  grossProfit: 'bg-[#3B6D11]',
  netProfit:   'bg-[#854F0B]',
  purchases:   'bg-[#888780]',
  expenses:    'bg-[#A32D2D]',
};
