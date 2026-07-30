/**
 * SalesReportTab — تقارير المبيعات (staffOrders بـ orderType='sale')
 * ملخص + جدول بالصنف + بالقسم + بالموظف + رسم يومي
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { useSalesReport } from '../../../hooks/useOrders';
import { useTabSearchParam } from '../../../hooks/useTabSearchParam';
import { Button, DataBar, FilterToolbar, SimpleTable as UiSimpleTable, Spinner } from '../../../ui';
import type { SimpleTableColumn } from '../../../ui';
import { DateFilterBar, type DateFilterController } from '../../../ui/date';
import type {
  StaffSaleReport,
  StaffSaleReportLogRow,
  StaffSaleReportProductRow,
  StaffSaleReportUserRow,
} from '../../../types/api';

const REPORT_VIEW_IDS = ['log', 'missing', 'product', 'section', 'user', 'day'] as const;

// ── بطاقة KPI صغيرة ─────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="nx-orders-kpi-tile rounded-lg border border-noorix-border bg-noorix-bg-muted/50 p-3 flex flex-col gap-1 sm:bg-noorix-surface sm:p-4">
      <div className="text-[12px] text-noorix-muted">{label}</div>
      <div className={`text-[22px] font-bold nx-font-numbers ${color}`}>{value}</div>
    </div>
  );
}

// ── جدول بسيط ───────────────────────────────────────────────────
function SimpleTable({ headers, rows, emptyMsg }: { headers: string[]; rows: (string | number)[][]; emptyMsg: string }) {
  const data = rows.map((cells, index) => ({ id: index, cells }));
  const columns: SimpleTableColumn<(typeof data)[number]>[] = headers.map((header, index) => ({
    key: `c${index}`,
    label: header,
    align: 'center',
    render: (_value, row) => row.cells[index] ?? '—',
  }));
  return (
    <UiSimpleTable
      columns={columns}
      data={data}
      tableMinWidth={Math.max(360, headers.length * 120)}
      compact
      emptyMessage={emptyMsg}
      frameClassName="border-0 rounded-none shadow-none"
    />
  );
}

// ── التبويب الرئيسي ──────────────────────────────────────────────
export function SalesReportTab({ companyId, dateFilter }: { companyId: string; dateFilter: DateFilterController }) {
  const { t, lang } = useTranslation();
  const [activeView, setActiveView] = useTabSearchParam(
    REPORT_VIEW_IDS,
    'log',
    'ordersReportView',
    null,
    undefined,
    { persistDefault: true },
  );

  const { data: report, isLoading, isError, error } = useSalesReport(companyId, {
    startDate: dateFilter.startDate,
    endDate: dateFilter.endDate,
  });

  const typedReport: StaffSaleReport | undefined = report;
  const summary = typedReport?.summary ?? { totalOrders: 0, totalQty: 0, totalAmount: 0, avgPerOrder: 0, uniqueProducts: 0, uniqueSections: 0 };
  const byProduct = typedReport?.byProduct ?? [];
  const bySection = typedReport?.bySection ?? [];
  const byUser    = typedReport?.byUser ?? [];
  const byDay     = typedReport?.byDay ?? [];
  const byLog     = typedReport?.byLog ?? [];
  const registrationCoverage = typedReport?.registrationCoverage ?? {
    startDate: '',
    endDate: '',
    expectedSectionDays: 0,
    registeredSectionDays: 0,
    missingSectionDays: 0,
    affectedSections: 0,
    sections: [],
    missingDays: [],
  };
  const coverageHasStarted = registrationCoverage.sections.length > 0;

  function productName(p: StaffSaleReportProductRow): string {
    return (lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn)) || '—';
  }

  function userName(u: StaffSaleReportUserRow | StaffSaleReportLogRow): string {
    return u.username
      || (lang === 'en' ? (u.nameEn || u.nameAr) : (u.nameAr || u.nameEn))
      || '—';
  }

  // بيانات كل جدول
  const productRows = useMemo(() =>
    byProduct.map((p, i) => [
      i + 1,
      productName(p),
      fmt(p.qty, 2),
      p.unit === 'pack'
        ? t('ordersUnitPack')
        : p.unit === 'half_pack'
          ? t('ordersUnitHalfPack')
        : p.unit === 'carton'
          ? t('ordersUnitCarton')
          : (p.unit || '—'),
      (p.sections || []).join(' · ') || '—',
    ]), [byProduct, lang, t]);

  const sectionRows = useMemo(() =>
    bySection.map((s, i) => [
      i + 1,
      s.sectionName,
      fmt(s.qty, 0),
      s.ordersCount,
      Number(s.totalAmount) !== 0 ? fmt(s.totalAmount) : '—',
      Number(s.averageAmount) !== 0 ? fmt(s.averageAmount) : '—',
    ]), [bySection]);

  const userRows = useMemo(() =>
    byUser.map((u, i) => [
      i + 1,
      userName(u),
      u.ordersCount,
      fmt(u.qty, 0),
    ]), [byUser, lang]);

  const dayRows = useMemo(() =>
    byDay.map((d) => [
      d.date,
      d.ordersCount,
      fmt(d.qty, 0),
    ]), [byDay]);

  const logRows = useMemo(() =>
    byLog.map((row, i) => [
      i + 1,
      row.logRef || '—',
      row.date,
      userName(row),
      row.sectionsCount ?? (row.sections?.length ?? 0),
      fmt(row.qty, 0),
      row.totalAmount > 0 ? fmt(row.totalAmount) : '—',
      row.avgPerOrder > 0 ? fmt(row.avgPerOrder) : '—',
      (row.sections || []).join(' · ') || '—',
    ]), [byLog, lang]);

  const missingDayRows = useMemo(() =>
    registrationCoverage.missingDays.map((row, index) => [
      index + 1,
      formatSaudiDate(row.date),
      row.sectionName,
      t('salesReportNotRegistered'),
    ]), [registrationCoverage.missingDays, t]);

  const views = [
    { id: 'log',     label: t('salesReportByLog') },
    { id: 'missing', label: t('salesReportMissingDaysTab') },
    { id: 'product', label: t('salesReportByProduct') },
    { id: 'section', label: t('salesReportBySection') },
    { id: 'user',    label: t('salesReportByUser') },
    { id: 'day',     label: t('salesReportByDay') },
  ];

  return (
    <div className="nx-orders-tab-root flex flex-col gap-3 sm:gap-4">
      <div className="rounded-lg border border-noorix-amber/30 bg-noorix-amber/5 px-3 py-2 text-[12px] text-noorix-muted leading-relaxed">
        {t('staffInternalSalesReportHint')}
      </div>
      {/* ── شريط التحكم ── */}
      <FilterToolbar variant="bare" className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2.5 flex flex-wrap items-center gap-2 sm:bg-noorix-surface sm:px-4 sm:py-3 sm:shadow-sm">
        <span className="text-[13px] font-semibold">{t('salesReportTitle')}</span>
        <DateFilterBar filter={dateFilter} />
        <span className="text-[12px] text-noorix-muted ms-auto">
          {isLoading ? '...' : `${dateFilter.label} · ${byDay.length} ${t('salesReportDays')}`}
        </span>
      </FilterToolbar>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isError ? (
        <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 p-6 text-center text-noorix-red text-[14px]">
          {(error as Error)?.message || t('salesReportEmpty')}
        </div>
      ) : (
        <>
          <div className={`rounded-xl border px-4 py-3 ${
            !coverageHasStarted
              ? 'border-noorix-border bg-noorix-bg-muted/40'
              : registrationCoverage.missingSectionDays > 0
              ? 'border-noorix-amber/35 bg-noorix-amber/5'
              : 'border-noorix-green/30 bg-noorix-green/5'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-noorix-text">
                  {t('salesReportRegistrationCoverage')}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-noorix-muted">
                  {!coverageHasStarted
                    ? t('salesReportRegistrationNotStarted')
                    : registrationCoverage.missingSectionDays > 0
                    ? t(
                        'salesReportMissingDaysSummary',
                        registrationCoverage.missingSectionDays,
                        registrationCoverage.affectedSections,
                      )
                    : t('salesReportRegistrationComplete')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-center">
                  <div className="text-[18px] font-bold nx-font-numbers text-noorix-amber">
                    {registrationCoverage.missingSectionDays}
                  </div>
                  <div className="text-[10px] text-noorix-muted">{t('salesReportMissingDays')}</div>
                </div>
                <div className="rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 text-center">
                  <div className="text-[18px] font-bold nx-font-numbers text-noorix-blue">
                    {registrationCoverage.affectedSections}
                  </div>
                  <div className="text-[10px] text-noorix-muted">{t('salesReportAffectedSections')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── بطاقات KPI ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label={t('salesReportOrders')}   value={fmt(summary.totalOrders ?? 0, 0)}   color="text-noorix-blue" />
            <KpiCard label={t('salesReportItems')}    value={fmt(summary.totalQty ?? 0, 0)}      color="text-noorix-green" />
            <KpiCard label={t('total')} value={summary.totalAmount > 0 ? fmt(summary.totalAmount) : '—'} color="text-noorix-green" />
            <KpiCard label={t('avgPerOrder')} value={summary.avgPerOrder > 0 ? fmt(summary.avgPerOrder) : '—'} color="text-noorix-violet" />
            <KpiCard label={t('salesReportProducts')} value={summary.uniqueProducts ?? 0}        color="text-noorix-violet" />
            <KpiCard label={t('salesReportSections')} value={summary.uniqueSections ?? 0}        color="text-noorix-amber" />
          </div>

          {/* ── رسم بياني يومي بسيط ── */}
          {byDay.length > 0 && (
            <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-3 sm:bg-noorix-surface sm:p-4 sm:shadow-sm">
              <div className="text-[13px] font-semibold mb-3">{t('salesReportByDay')}</div>
              <div className="flex items-end gap-1 h-16 overflow-x-auto">
                {(() => {
                  const maxQty = Math.max(...byDay.map((d) => d.qty), 1);
                  return byDay.map((d) => (
                    <div key={d.date} className="flex flex-col items-center gap-0.5 shrink-0" title={`${d.date}: ${d.qty}`}>
                      <DataBar
                        className="w-5 rounded-t-sm bg-noorix-blue/70 transition-all"
                        heightPx={Math.max(4, (d.qty / maxQty) * 56)}
                      />
                      <div className="text-[11px] text-noorix-muted">{d.date.slice(5)}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* ── تبويبات الجداول ── */}
          <div className="overflow-hidden rounded-lg border border-noorix-border bg-noorix-surface">
            <div className="flex border-b border-noorix-border overflow-x-auto">
              {views.map((v) => (
                <Button
                  key={v.id}
                  type="button"
                  variant="raw"
                  size="auto"
                  onClick={() => setActiveView(v.id)}
                  className={`px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors
                    ${activeView === v.id
                      ? 'border-noorix-blue text-noorix-blue'
                      : 'border-transparent text-noorix-muted hover:text-noorix-text'
                    }`}
                >
                  {v.label}
                </Button>
              ))}
            </div>

            <div className="p-2">
              {activeView === 'log' && (
                <SimpleTable
                  headers={['#', t('staffSaleLogRef'), t('date'), t('staffSaleUsername'), t('salesReportSections'), t('quantity'), t('total'), t('avgPerOrder'), t('productSections')]}
                  rows={logRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
              {activeView === 'missing' && (
                <SimpleTable
                  headers={[
                    '#',
                    t('date'),
                    t('staffOrderSection'),
                    t('status'),
                  ]}
                  rows={missingDayRows}
                  emptyMsg={t('salesReportNoMissingDays')}
                />
              )}
              {activeView === 'product' && (
                <SimpleTable
                  headers={['#', t('product'), t('quantity'), t('ordersUnit'), t('sections')]}
                  rows={productRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
              {activeView === 'section' && (
                <SimpleTable
                  headers={[
                    '#',
                    t('staffOrderSection'),
                    t('quantity'),
                    t('ordersCount'),
                    t('salesReportTotalValue'),
                    t('salesReportAverageValue'),
                  ]}
                  rows={sectionRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
              {activeView === 'user' && (
                <SimpleTable
                  headers={['#', t('staffSaleUsername'), t('ordersCount'), t('quantity')]}
                  rows={userRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
              {activeView === 'day' && (
                <SimpleTable
                  headers={[t('date'), t('ordersCount'), t('quantity')]}
                  rows={dayRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
            </div>
          </div>

          {byProduct.length === 0 && byDay.length === 0 && (
            <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-10 text-center text-noorix-muted text-[14px] sm:bg-noorix-surface">
              {t('salesReportEmpty')}
            </div>
          )}
        </>
      )}
    </div>
  );
}
