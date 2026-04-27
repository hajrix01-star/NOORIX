import type { GeminiIntent, GeminiPeriod } from './gemini-types';

export function normalizeGeminiIntent(v: unknown): GeminiIntent {
  const s = String(v || '').toLowerCase();
  const valid: GeminiIntent[] = [
    'sales', 'purchases', 'expenses', 'reports', 'vaults',
    'invoices', 'suppliers', 'categories', 'expense_lines', 'hr', 'orders', 'help',
    'finance_ratios', 'sales_month_compare', 'unknown',
  ];
  return valid.includes(s as GeminiIntent) ? (s as GeminiIntent) : 'unknown';
}

export function normalizeGeminiPeriod(v: unknown): GeminiPeriod {
  if (v === null || v === undefined) return null;
  const s = String(v).toLowerCase();
  const valid: GeminiPeriod[] = [
    'today', 'yesterday', 'day_before_yesterday',
    'this_week', 'last_week', 'this_month', 'last_month', 'year',
  ];
  return valid.includes(s as GeminiPeriod) ? (s as GeminiPeriod) : null;
}
