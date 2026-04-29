export type GeminiIntent =
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'reports'
  | 'vaults'
  | 'invoices'
  | 'suppliers'
  | 'categories'
  | 'expense_lines'
  | 'hr'
  | 'orders'
  | 'help'
  | 'finance_ratios'
  | 'sales_month_compare'
  | 'dashboard_insights'
  | 'unknown';

export type GeminiPeriod =
  | 'today'
  | 'yesterday'
  | 'day_before_yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'year'
  | null;

export type GeminiParseResult = {
  intent: GeminiIntent;
  period: GeminiPeriod;
  rawQuery: string;
};
