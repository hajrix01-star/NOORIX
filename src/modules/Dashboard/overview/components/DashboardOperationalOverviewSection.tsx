import React from 'react';
import { FmtNum } from '../../../../ui';
import type { DashboardOperationalOverview } from '../../../../types/api/domains/dashboard';
import { DashboardOverviewBreakdownTable } from './DashboardOverviewBreakdownTable';

type Props = {
  overview: DashboardOperationalOverview;
  lang: string;
  t: (key: string) => string;
};

function Money({ value }: { value: string | number }) {
  return (
    <span dir="ltr" className="inline-flex items-baseline justify-center gap-1 nx-font-numbers font-bold text-noorix-text">
      <FmtNum n={value} maxDecimals={1} />
      <span className="nx-sar">SR</span>
    </span>
  );
}

function Ratio({ value }: { value: number | null }) {
  return (
    <span dir="ltr" className="nx-font-numbers font-bold text-nx-sales">
      {value == null ? '—' : `${value.toFixed(1)}%`}
    </span>
  );
}

export function DashboardOperationalOverviewSection({ overview, lang, t }: Props) {
  const categories = (overview.purchases.categories ?? []).map((row, index) => ({
    key: row.categoryId ?? `uncategorized-${index}`,
    label: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || t('notSpecified'),
    amount: Number(row.amount || 0),
    pct: row.sharePct == null ? '0.0' : Number(row.sharePct).toFixed(1),
  }));

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <article className="noorix-surface-card min-w-0 overflow-hidden">
        <div className="border-b border-noorix-border px-4 py-4 text-center sm:px-5">
          <h2 className="m-0 text-[16px] font-bold text-noorix-text">{t('dashboardFixedExpensesTitle')}</h2>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{t('dashboardFixedExpensesDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
          <div className="rounded-xl bg-noorix-bg-muted px-3 py-4 text-center">
            <div className="text-[12px] text-noorix-muted">{t('dashboardPeriodAmount')}</div>
            <div className="mt-2 text-[20px]"><Money value={overview.fixedExpenses.amount} /></div>
          </div>
          <div className="rounded-xl bg-noorix-bg-muted px-3 py-4 text-center">
            <div className="text-[12px] text-noorix-muted">{t('dashboardShareOfSales')}</div>
            <div className="mt-2 text-[20px]"><Ratio value={overview.fixedExpenses.shareOfSalesPct} /></div>
          </div>
        </div>
        <div className="mx-4 mb-4 flex items-center justify-between rounded-lg border border-noorix-border px-3 py-2 text-[12px] sm:mx-5 sm:mb-5">
          <span className="text-noorix-muted">{t('dashboardFixedExpenseInvoices')}</span>
          <span className="nx-font-numbers font-bold text-noorix-text"><FmtNum n={overview.fixedExpenses.invoiceCount} /></span>
        </div>
      </article>

      <article className="noorix-surface-card min-w-0 overflow-hidden">
        <div className="border-b border-noorix-border px-4 py-4 text-center sm:px-5">
          <h2 className="m-0 text-[16px] font-bold text-noorix-text">{t('dashboardPurchasesOverviewTitle')}</h2>
          <p className="m-0 mt-1 text-[12px] text-noorix-muted">{t('dashboardPurchasesOverviewDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4 pb-3 sm:px-5">
          <div className="rounded-xl bg-noorix-bg-muted px-3 py-3 text-center">
            <div className="text-[12px] text-noorix-muted">{t('dashboardPurchasesTotalForPeriod')}</div>
            <div className="mt-1 text-[17px]"><Money value={overview.purchases.amount} /></div>
          </div>
          <div className="rounded-xl bg-noorix-bg-muted px-3 py-3 text-center">
            <div className="text-[12px] text-noorix-muted">{t('dashboardShareOfSales')}</div>
            <div className="mt-1 text-[17px]"><Ratio value={overview.purchases.shareOfSalesPct} /></div>
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {categories.length > 0 ? (
            <DashboardOverviewBreakdownTable
              rows={categories}
              labelHeader={t('category')}
              showCurrency
              compact
              t={t}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-noorix-border px-3 py-6 text-center text-[12px] text-noorix-muted">
              {t('dashboardNoPurchasesByCategory')}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
