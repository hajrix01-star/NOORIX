/**
 * أنواع عرض رؤى لوحة التحكم — مطابقة لما يُعرض فقط (ليست الحمولة الكاملة من الـ API).
 */
export type DashboardInsightSeverity = 'info' | 'warning' | 'critical';

export type DashboardInsightMetricBasis = 'accounting_pl' | 'operational_sales' | 'invoice_period';

export type DashboardInsightDisplayItem = {
  id: string;
  severity: DashboardInsightSeverity;
  metricBasis: DashboardInsightMetricBasis;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
};

export type DashboardInsightsUi =
  | { show: false }
  | { show: true; state: 'loading' }
  | { show: true; state: 'ready'; items: DashboardInsightDisplayItem[] };
