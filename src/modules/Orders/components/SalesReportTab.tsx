/**
 * SalesReportTab — تقارير المبيعات (staffOrders بـ orderType='sale')
 * ملخص + جدول بالصنف + بالقسم + بالموظف + رسم يومي
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { fmt } from '../../../utils/format';
import { useSalesReport } from '../../../hooks/useOrders';
import { useTabSearchParam } from '../../../hooks/useTabSearchParam';
import { Badge, Input, Spinner, ScreenShell, ScreenTitle } from '../../../ui';

const PERIOD_OPTIONS = [7, 14, 30, 60, 90];
const REPORT_VIEW_IDS = ['log', 'product', 'section', 'user', 'day'] as const;

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
  if (rows.length === 0) {
    return <div className="text-center text-noorix-muted py-6 text-[13px]">{emptyMsg}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-noorix-border">
            {headers.map((h, i) => (
              <th key={i} className="text-start py-2 px-3 text-[11px] text-noorix-muted font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-noorix-border">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-noorix-bg-muted/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 px-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── التبويب الرئيسي ──────────────────────────────────────────────
export function SalesReportTab({ companyId }: { companyId: string }) {
  const { t, lang } = useTranslation();
  const [days, setDays] = useState(30);
  const [activeView, setActiveView] = useTabSearchParam(
    REPORT_VIEW_IDS,
    'log',
    'ordersReportView',
    null,
    undefined,
    { persistDefault: true },
  );

  const { data: report, isLoading, isError, error } = useSalesReport(companyId, days);

  const summary = (report as any)?.summary ?? {};
  const byProduct: any[] = (report as any)?.byProduct ?? [];
  const bySection: any[] = (report as any)?.bySection ?? [];
  const byUser: any[]    = (report as any)?.byUser ?? [];
  const byDay: any[]     = (report as any)?.byDay ?? [];
  const byLog: any[]     = (report as any)?.byLog ?? [];

  function productName(p: any): string {
    return lang === 'en' ? (p.nameEn || p.nameAr) : (p.nameAr || p.nameEn);
  }

  function userName(u: any): string {
    return lang === 'en' ? (u.nameEn || u.nameAr) : (u.nameAr || u.nameEn);
  }

  // بيانات كل جدول
  const productRows = useMemo(() =>
    byProduct.map((p, i) => [
      i + 1,
      productName(p),
      fmt(p.qty, 0),
      p.unit || '—',
      (p.sections || []).join(' · ') || '—',
    ]), [byProduct, lang]);

  const sectionRows = useMemo(() =>
    bySection.map((s, i) => [
      i + 1,
      s.sectionName,
      fmt(s.qty, 0),
      s.ordersCount,
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
      (row.sections || []).join(' · ') || '—',
    ]), [byLog, lang]);

  const views = [
    { id: 'log',     label: t('salesReportByLog') },
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
      <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2.5 flex flex-wrap items-center gap-2 sm:bg-noorix-surface sm:px-4 sm:py-3 sm:shadow-sm">
        <span className="text-[13px] font-semibold">{t('salesReportTitle')}</span>
        <Input
          type="select"
          value={String(days)}
          onChange={(e: any) => setDays(Number(e.target.value))}
          className="w-[140px]"
        >
          {PERIOD_OPTIONS.map((d) => (
            <option key={d} value={d}>{t('salesReportLast')} {d} {t('salesReportDays')}</option>
          ))}
        </Input>
        <span className="text-[12px] text-noorix-muted ms-auto">
          {isLoading ? '...' : `${byDay.length} ${t('salesReportDays')}`}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isError ? (
        <div className="rounded-lg border border-noorix-red/30 bg-noorix-red/5 p-6 text-center text-noorix-red text-[14px]">
          {(error as Error)?.message || t('salesReportEmpty')}
        </div>
      ) : (
        <>
          {/* ── بطاقات KPI ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label={t('salesReportOrders')}   value={fmt(summary.totalOrders ?? 0, 0)}   color="text-noorix-blue" />
            <KpiCard label={t('salesReportItems')}    value={fmt(summary.totalQty ?? 0, 0)}      color="text-noorix-green" />
            <KpiCard label={t('salesReportProducts')} value={summary.uniqueProducts ?? 0}        color="text-noorix-violet" />
            <KpiCard label={t('salesReportSections')} value={summary.uniqueSections ?? 0}        color="text-noorix-amber" />
          </div>

          {/* ── رسم بياني يومي بسيط ── */}
          {byDay.length > 0 && (
            <div className="rounded-lg border border-noorix-border bg-noorix-bg-muted/40 p-3 sm:bg-noorix-surface sm:p-4 sm:shadow-sm">
              <div className="text-[13px] font-semibold mb-3">{t('salesReportByDay')}</div>
              <div className="flex items-end gap-1 h-16 overflow-x-auto">
                {(() => {
                  const maxQty = Math.max(...byDay.map((d: any) => d.qty), 1);
                  return byDay.map((d: any) => (
                    <div key={d.date} className="flex flex-col items-center gap-0.5 shrink-0" title={`${d.date}: ${d.qty}`}>
                      <div
                        className="w-5 rounded-t-sm bg-noorix-blue/70 transition-all"
                        style={{ height: `${Math.max(4, (d.qty / maxQty) * 56)}px` }}
                      />
                      <div className="text-[9px] text-noorix-muted">{d.date.slice(5)}</div>
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
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveView(v.id as any)}
                  className={`px-4 py-3 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors
                    ${activeView === v.id
                      ? 'border-noorix-blue text-noorix-blue'
                      : 'border-transparent text-noorix-muted hover:text-noorix-text'
                    }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="p-2">
              {activeView === 'log' && (
                <SimpleTable
                  headers={['#', t('staffSaleLogRef'), t('date'), t('employee'), t('salesReportSections'), t('quantity'), t('productSections')]}
                  rows={logRows}
                  emptyMsg={t('salesReportEmpty')}
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
                  headers={['#', t('staffOrderSection'), t('quantity'), t('ordersCount')]}
                  rows={sectionRows}
                  emptyMsg={t('salesReportEmpty')}
                />
              )}
              {activeView === 'user' && (
                <SimpleTable
                  headers={['#', t('employee'), t('ordersCount'), t('quantity')]}
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
