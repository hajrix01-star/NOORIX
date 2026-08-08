import React from 'react';
import { FmtNum } from '../../../../ui';
import type { DashboardOperationalOverview } from '../../../../types/api/domains/dashboard';
import { DashboardOverviewBreakdownTable } from './DashboardOverviewBreakdownTable';

type Props = {
  overview: DashboardOperationalOverview;
  lang: string;
  t: (key: string) => string;
};

type BreakdownRow = {
  id?: string | null;
  categoryId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  amount?: string | number | null;
  sharePct?: number | null;
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

function normalizeRows(rows: readonly BreakdownRow[], lang: string, fallback: string) {
  return rows.map((row, index) => ({
    key: row.id ?? row.categoryId ?? `summary-${index}`,
    label: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || fallback,
    amount: Number(row.amount || 0),
    pct: row.sharePct == null ? '0.0' : Number(row.sharePct).toFixed(1),
  }));
}

function CostBreakdownCard({
  title, description, amount, shareOfSalesPct, rows, countLabel, count, emptyMessage, lang, t,
}: {
  title: string;
  description: string;
  amount: string | number;
  shareOfSalesPct: number | null;
  rows: readonly BreakdownRow[];
  countLabel?: string;
  count?: number;
  emptyMessage: string;
  lang: string;
  t: (key: string) => string;
}) {
  const categories = normalizeRows(rows, lang, t('notSpecified'));
  return (
    <article className="noorix-surface-card min-w-0 overflow-hidden">
      <div className="border-b border-noorix-border px-4 py-4 text-center sm:px-5">
        <h2 className="m-0 text-[16px] font-bold text-noorix-text">{title}</h2>
        <p className="m-0 mt-1 text-[12px] text-noorix-muted">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 pb-3 sm:px-5">
        <div className="rounded-xl bg-noorix-bg-muted px-3 py-3 text-center">
          <div className="text-[12px] text-noorix-muted">{t('dashboardPeriodAmount')}</div>
          <div className="mt-1 text-[17px]"><Money value={amount} /></div>
        </div>
        <div className="rounded-xl bg-noorix-bg-muted px-3 py-3 text-center">
          <div className="text-[12px] text-noorix-muted">{t('dashboardShareOfSales')}</div>
          <div className="mt-1 text-[17px]"><Ratio value={shareOfSalesPct} /></div>
        </div>
      </div>
      {countLabel != null && count != null ? (
        <div className="mx-4 mb-3 flex items-center justify-between rounded-lg border border-noorix-border px-3 py-2 text-[12px] sm:mx-5">
          <span className="text-noorix-muted">{countLabel}</span>
          <span className="nx-font-numbers font-bold text-noorix-text"><FmtNum n={count} /></span>
        </div>
      ) : null}
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
            {emptyMessage}
          </div>
        )}
      </div>
    </article>
  );
}

export function DashboardOperationalOverviewSection({ overview, lang, t }: Props) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:items-start">
      <article className="noorix-surface-card min-w-0 overflow-hidden xl:col-span-3">
        <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 text-center sm:flex-row sm:px-5 sm:text-start">
          <div>
            <h2 className="m-0 text-[16px] font-bold text-noorix-text">{t('dashboardOperatingCostsTitle')}</h2>
            <p className="m-0 mt-1 text-[12px] text-noorix-muted">{t('dashboardOperatingCostsDesc')}</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-noorix-bg-muted px-4 py-2">
            <div className="text-[18px]"><Money value={overview.operatingCosts.amount} /></div>
            <Ratio value={overview.operatingCosts.shareOfSalesPct} />
          </div>
        </div>
      </article>

      <CostBreakdownCard
        title={t('dashboardPurchasesOverviewTitle')}
        description={t('dashboardPurchasesOverviewDesc')}
        amount={overview.purchases.amount}
        shareOfSalesPct={overview.purchases.shareOfSalesPct}
        rows={overview.purchases.categories}
        emptyMessage={t('dashboardNoPurchasesByCategory')}
        lang={lang}
        t={t}
      />
      <CostBreakdownCard
        title={t('dashboardFixedExpensesTitle')}
        description={t('dashboardFixedExpensesDesc')}
        amount={overview.recurringCosts.amount}
        shareOfSalesPct={overview.recurringCosts.shareOfSalesPct}
        rows={overview.recurringCosts.categories}
        countLabel={t('dashboardFixedExpenseInvoices')}
        count={overview.recurringCosts.recordCount}
        emptyMessage={t('dashboardNoFixedExpenseDetails')}
        lang={lang}
        t={t}
      />
      <CostBreakdownCard
        title={t('dashboardOtherExpensesTitle')}
        description={t('dashboardOtherExpensesDesc')}
        amount={overview.otherExpenses.amount}
        shareOfSalesPct={overview.otherExpenses.shareOfSalesPct}
        rows={overview.otherExpenses.categories}
        emptyMessage={t('dashboardNoOtherExpensesByCategory')}
        lang={lang}
        t={t}
      />
    </section>
  );
}
