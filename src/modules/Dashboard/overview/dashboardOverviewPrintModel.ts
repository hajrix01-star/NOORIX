import type {
  DashboardKpiCardMetric,
  DashboardOperationalOverview,
  DashboardVaultActivity,
} from '../../../types/api/domains/dashboard';
import { formatMoney, formatPercent } from '../../../utils/money';
import type { DashboardOverviewFilter } from './types';

type Translate = (key: string) => string;

type DashboardOverviewPrintInput = {
  companyName: string;
  companyLogoUrl?: string | null;
  year: number;
  filter?: DashboardOverviewFilter;
  lang: string;
  t: Translate;
  kpiCardsByKey: Map<string, DashboardKpiCardMetric>;
  vaultActivity: DashboardVaultActivity;
  operationalOverview: DashboardOperationalOverview;
};

const MAX_VAULT_ROWS = 8;
const MAX_PURCHASE_CATEGORY_ROWS = 6;
const MAX_RECURRING_COST_ROWS = 5;
const MAX_OTHER_EXPENSE_ROWS = 5;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: unknown, lang: string): string {
  return `${formatMoney(value, lang)} SR`;
}

function amountCell(value: unknown, lang: string): string {
  return `<span class="dash-print-amount" dir="ltr">${esc(money(value, lang))}</span>`;
}

function pct(value: number | null | undefined, lang: string): string {
  return value == null ? '—' : formatPercent(value, lang);
}

function periodTitle(input: DashboardOverviewPrintInput): string {
  if (input.filter?.label) return input.filter.label;
  return String(input.year);
}

function metric(input: DashboardOverviewPrintInput, key: string): number {
  return Number(input.kpiCardsByKey.get(key)?.value ?? 0);
}

function kpiLabel(key: string, isArabic: boolean): string {
  const ar: Record<string, string> = {
    sales: 'المبيعات', purchases: 'المشتريات', expenses: 'التكاليف والمصاريف', grossProfit: 'المتبقي بعد المشتريات', netProfit: 'النتيجة التشغيلية',
  };
  const en: Record<string, string> = {
    sales: 'Sales', purchases: 'Purchases', expenses: 'Recurring and other expenses', grossProfit: 'After purchases', netProfit: 'Operating result',
  };
  return (isArabic ? ar : en)[key] ?? key;
}

function compactTable(headers: string[], rows: string[][], emptyLabel: string): string {
  const head = headers.map((label) => `<th>${esc(label)}</th>`).join('');
  const body = rows.length > 0
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
    : `<tr><td class="dash-print-empty" colspan="${headers.length}">${esc(emptyLabel)}</td></tr>`;
  return `<table class="dash-print-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** A compact, deterministic A4 portrait printout for the dashboard overview. */
export function buildDashboardOverviewPrintDocument(input: DashboardOverviewPrintInput) {
  const isArabic = input.lang !== 'en';
  const labels = isArabic
    ? {
        title: 'لوحة التحكم — النظرة العامة', period: 'الفترة', incoming: 'إجمالي الداخل', outgoing: 'صرف الخزائن', result: 'نتيجة الفترة', cashDifference: 'فرق النقد والتكلفة',
        vaults: 'حركة الخزائن', vault: 'الخزينة', share: 'النسبة من الداخل', fixed: 'التكاليف التشغيلية الدورية', purchases: 'المشتريات حسب الفئات', other: 'المصاريف الأخرى حسب الفئات', operating: 'إجمالي التكاليف التشغيلية',
        category: 'الفئة', amount: 'المبلغ', fixedCount: 'سجل', extra: 'عناصر إضافية غير معروضة للحفاظ على صفحة واحدة', none: 'لا توجد بيانات خلال الفترة',
      }
    : {
        title: 'Dashboard — Overview', period: 'Period', incoming: 'Total inflow', outgoing: 'Vault cash paid', result: 'Period result', cashDifference: 'Cash/cost difference',
        vaults: 'Vault activity', vault: 'Vault', share: 'Inflow share', fixed: 'Recurring operating costs', purchases: 'Purchases by category', other: 'Other expenses by category', operating: 'Total operating costs',
        category: 'Category', amount: 'Amount', fixedCount: 'records', extra: 'additional items omitted to keep one page', none: 'No data for this period',
      };

  const kpiKeys = ['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit'];
  const kpis = kpiKeys.map((key) => {
    const metricRow = input.kpiCardsByKey.get(key);
    return `<article class="dash-print-kpi">
      <div>${esc(kpiLabel(key, isArabic))}</div>
      <strong dir="ltr">${esc(money(metricRow?.value ?? 0, input.lang))}</strong>
      <small dir="ltr">${esc(pct(metricRow?.pct, input.lang))}</small>
    </article>`;
  }).join('');

  const vaultRows = (input.vaultActivity.rows ?? []).slice(0, MAX_VAULT_ROWS).map((row) => [
    esc((isArabic ? row.nameAr : row.nameEn || row.nameAr) || labels.vault),
    amountCell(row.inflow, input.lang),
    amountCell(row.outflow, input.lang),
    amountCell(row.periodResult, input.lang),
    `<span dir="ltr">${esc(pct(row.inflowSharePct, input.lang))}</span>`,
  ]);
  const purchaseRows = (input.operationalOverview.purchases.categories ?? []).slice(0, MAX_PURCHASE_CATEGORY_ROWS).map((row) => [
    esc((isArabic ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || labels.category),
    amountCell(row.amount, input.lang),
    `<span dir="ltr">${esc(pct(row.sharePct, input.lang))}</span>`,
  ]);
  const recurringRows = (input.operationalOverview.recurringCosts.categories ?? []).slice(0, MAX_RECURRING_COST_ROWS).map((row) => [
    esc((isArabic ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || labels.fixed),
    amountCell(row.amount, input.lang),
    `<span dir="ltr">${esc(pct(row.sharePct, input.lang))}</span>`,
  ]);
  const otherRows = (input.operationalOverview.otherExpenses.categories ?? []).slice(0, MAX_OTHER_EXPENSE_ROWS).map((row) => [
    esc((isArabic ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || labels.category),
    amountCell(row.amount, input.lang),
    `<span dir="ltr">${esc(pct(row.sharePct, input.lang))}</span>`,
  ]);
  const hiddenVaults = Math.max(0, (input.vaultActivity.rows?.length ?? 0) - MAX_VAULT_ROWS);
  const hiddenCategories = Math.max(0, (input.operationalOverview.purchases.categories?.length ?? 0) - MAX_PURCHASE_CATEGORY_ROWS);
  const hiddenRecurring = Math.max(0, (input.operationalOverview.recurringCosts.categories?.length ?? 0) - MAX_RECURRING_COST_ROWS);
  const hiddenOther = Math.max(0, (input.operationalOverview.otherExpenses.categories?.length ?? 0) - MAX_OTHER_EXPENSE_ROWS);

  const body = `<main class="dashboard-overview-print">
    <div class="dash-print-title"><strong>${esc(labels.title)}</strong><span>${esc(labels.period)}: ${esc(periodTitle(input))}</span></div>
    <section class="dash-print-kpis">${kpis}</section>
    <section class="dash-print-flow">
      <article><span>${esc(labels.incoming)}</span>${amountCell(input.vaultActivity.totalInflow, input.lang)}</article>
      <article><span>${esc(labels.outgoing)}</span>${amountCell(input.vaultActivity.totalOutflow, input.lang)}</article>
      <article><span>${esc(labels.cashDifference)}</span>${amountCell(Number(input.vaultActivity.totalOutflow || 0) - Number(input.operationalOverview.operatingCosts.amount || 0), input.lang)}</article>
      <article><span>${esc(labels.result)}</span>${amountCell(input.vaultActivity.periodResult, input.lang)}</article>
    </section>
    <section class="dash-print-operating"><span>${esc(labels.operating)}</span>${amountCell(input.operationalOverview.operatingCosts.amount, input.lang)}</section>
    <section class="dash-print-section">
      <h2>${esc(labels.vaults)}</h2>
      ${compactTable([labels.vault, labels.incoming, labels.outgoing, labels.result, labels.share], vaultRows, labels.none)}
      ${hiddenVaults ? `<p class="dash-print-note">+${hiddenVaults} ${esc(labels.extra)}</p>` : ''}
    </section>
    <section class="dash-print-columns">
      <article class="dash-print-section">
        <h2>${esc(labels.fixed)} <small>(${input.operationalOverview.recurringCosts.recordCount} ${esc(labels.fixedCount)})</small></h2>
        <div class="dash-print-section-total">${amountCell(input.operationalOverview.recurringCosts.amount, input.lang)} <span dir="ltr">${esc(pct(input.operationalOverview.recurringCosts.shareOfSalesPct, input.lang))}</span></div>
        ${compactTable([labels.category, labels.amount, labels.share], recurringRows, labels.none)}
        ${hiddenRecurring ? `<p class="dash-print-note">+${hiddenRecurring} ${esc(labels.extra)}</p>` : ''}
      </article>
      <article class="dash-print-section">
        <h2>${esc(labels.purchases)}</h2>
        <div class="dash-print-section-total">${amountCell(input.operationalOverview.purchases.amount, input.lang)} <span dir="ltr">${esc(pct(input.operationalOverview.purchases.shareOfSalesPct, input.lang))}</span></div>
        ${compactTable([labels.category, labels.amount, labels.share], purchaseRows, labels.none)}
        ${hiddenCategories ? `<p class="dash-print-note">+${hiddenCategories} ${esc(labels.extra)}</p>` : ''}
      </article>
      <article class="dash-print-section">
        <h2>${esc(labels.other)}</h2>
        <div class="dash-print-section-total">${amountCell(input.operationalOverview.otherExpenses.amount, input.lang)} <span dir="ltr">${esc(pct(input.operationalOverview.otherExpenses.shareOfSalesPct, input.lang))}</span></div>
        ${compactTable([labels.category, labels.amount, labels.share], otherRows, labels.none)}
        ${hiddenOther ? `<p class="dash-print-note">+${hiddenOther} ${esc(labels.extra)}</p>` : ''}
      </article>
    </section>
  </main>`;

  return {
    title: labels.title,
    previewTitle: labels.title,
    companyName: input.companyName,
    logoUrl: input.companyLogoUrl || '',
    subtitle: `${labels.period}: ${periodTitle(input)}`,
    body,
    landscape: false,
    showPageCounter: false,
    pageMarginMm: 8,
    htmlDir: isArabic ? 'rtl' as const : 'ltr' as const,
    htmlLang: isArabic ? 'ar' : 'en',
    extraCss: `
      .dashboard-overview-print { font-size: 9px; line-height: 1.25; }
      .print-header { padding-bottom: 6px; margin-bottom: 7px; }
      .print-header img { max-height: 28px; margin-bottom: 2px; }
      .print-header h1 { font-size: 15px; margin-bottom: 1px; }
      .print-header .sub { font-size: 9px; }
      .dash-print-title { display:flex; justify-content:space-between; gap:8px; margin-bottom:6px; font-size:9px; color:#475569; }
      .dash-print-title strong { color:#0f172a; font-size:12px; }
      .dash-print-kpis { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:4px; margin-bottom:6px; }
      .dash-print-kpi, .dash-print-flow article { border:1px solid #cbd5e1; border-radius:5px; padding:5px 4px; text-align:center; break-inside:avoid; }
      .dash-print-kpi div, .dash-print-flow span { color:#64748b; font-size:8px; }
      .dash-print-kpi strong { display:block; margin-top:3px; color:#0f172a; font-size:10px; }
      .dash-print-kpi small { display:block; margin-top:2px; color:#475569; font-size:8px; }
      .dash-print-flow { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:4px; margin-bottom:6px; }
      .dash-print-flow .dash-print-amount { display:block; margin-top:3px; font-size:10px; }
      .dash-print-operating { display:flex; justify-content:space-between; align-items:center; border:1px solid #bbd7c6; border-radius:5px; padding:5px 7px; margin-bottom:6px; color:#14532d; font-size:9px; font-weight:700; }
      .dash-print-columns { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:5px; align-items:start; }
      .dash-print-section { border:1px solid #cbd5e1; border-radius:5px; padding:5px; margin-bottom:6px; break-inside:avoid; overflow:hidden; }
      .dash-print-section h2 { margin:0 0 4px; font-size:10px; color:#0f172a; }
      .dash-print-section h2 small { color:#64748b; font-size:8px; font-weight:400; }
      .dash-print-section-total { display:flex; justify-content:space-between; align-items:center; margin:0 0 4px; color:#334155; font-size:8px; }
      .dash-print-table { table-layout:fixed; font-size:8px; }
      .dash-print-table th, .dash-print-table td { padding:3px 4px; text-align:center; overflow-wrap:anywhere; vertical-align:middle; }
      .dash-print-table th { background:#e7f0f8; color:#16324f; font-size:8px; }
      .dash-print-table tr:nth-child(even) td { background:#f8fafc; }
      .dash-print-table th:first-child, .dash-print-table td:first-child { text-align:start; }
      .dash-print-table th:first-child { width:30%; }
      .dash-print-amount { font-weight:700; white-space:nowrap; }
      .dash-print-empty { color:#64748b; padding:6px !important; }
      .dash-print-note { margin:3px 0 0; text-align:center; color:#64748b; font-size:7px; }
      .print-footer { margin-top:5px; padding-top:4px; font-size:8px; }
      @media print { .dashboard-overview-print { max-height:270mm; overflow:hidden; } }
    `,
  };
}
